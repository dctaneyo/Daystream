import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import pg from "pg";

/**
 * End-to-end smoke test against a running Daystream server.
 *  1. health + 6-digit ID/PIN login through Auth.js
 *  2. admin console access, and a non-admin being bounced out of it
 *  3. PIN lockout after repeated failures
 *  4. collab token, Yjs sync over WebSocket, Postgres persistence + projection
 *  5. search over the projection
 */

const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const WS_URL = BASE.replace(/^http/, "ws") + "/collab";
const SECRET = process.env.AUTH_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

const ADMIN = { publicId: "100001", pin: "123456" };
const MEMBER = { publicId: "100002", pin: "654321" };
const LOCKOUT_ID = "100003";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function cookiePairs(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  return raw.map((entry) => entry.split(";")[0]).join("; ");
}

function mergeCookies(...headers) {
  const jar = new Map();
  for (const header of headers.filter(Boolean)) {
    for (const pair of header.split("; ")) {
      const [name, ...rest] = pair.split("=");
      if (name) jar.set(name, `${name}=${rest.join("=")}`);
    }
  }
  return [...jar.values()].join("; ");
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return await response.json();
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("server never became healthy");
}

async function login({ publicId, pin }) {
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  const csrfCookies = cookiePairs(csrfResponse);
  const { csrfToken } = await csrfResponse.json();

  const response = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: csrfCookies },
    body: new URLSearchParams({ csrfToken, userId: publicId, pin, callbackUrl: `${BASE}/app` }),
    redirect: "manual",
  });

  const cookies = mergeCookies(csrfCookies, cookiePairs(response));
  return { status: response.status, cookies, signedIn: cookies.includes("session-token") };
}

const health = await waitForHealth();
check("health endpoint", health.ok === true, JSON.stringify(health));

const landing = await fetch(`${BASE}/`);
const landingHtml = landing.status === 200 ? await landing.text() : "";
check(
  "theme control + pre-paint script present",
  landingHtml.includes('data-theme-option="system"') &&
    landingHtml.includes('data-theme-option="dark"') &&
    landingHtml.includes("daystream-theme"),
);

const adminLogin = await login(ADMIN);
check("admin PIN login", adminLogin.status < 400 && adminLogin.signedIn, `status ${adminLogin.status}`);

const today = new Date().toISOString().slice(0, 10);

const dayPage = await fetch(`${BASE}/app`, { headers: { cookie: adminLogin.cookies }, redirect: "manual" });
const dayHtml = dayPage.status === 200 ? await dayPage.text() : "";
check("day page renders for admin", dayPage.status === 200 && dayHtml.includes("Daystream"), `status ${dayPage.status}`);
check(
  "day view lists the Notes for that day",
  dayHtml.includes('data-day-notes="true"') && dayHtml.includes('aria-label="New Note"'),
);
check("keyboard-aware viewport configured", dayHtml.includes("resizes-content"), "interactive-widget");

const anon = await fetch(`${BASE}/app`, { redirect: "manual" });
check("app redirects anonymous users", anon.status === 307 || anon.status === 302, `status ${anon.status}`);

const adminConsole = await fetch(`${BASE}/admin`, { headers: { cookie: adminLogin.cookies }, redirect: "manual" });
const adminHtml = adminConsole.status === 200 ? await adminConsole.text() : "";
check("admin console renders", adminConsole.status === 200 && adminHtml.includes("Overview"), `status ${adminConsole.status}`);

const adminUsers = await fetch(`${BASE}/admin/users`, { headers: { cookie: adminLogin.cookies }, redirect: "manual" });
const adminUsersHtml = adminUsers.status === 200 ? await adminUsers.text() : "";
check(
  "admin users page lists accounts",
  adminUsers.status === 200 && adminUsersHtml.includes(ADMIN.publicId),
  `status ${adminUsers.status}`,
);

const memberLogin = await login(MEMBER);
check("member PIN login", memberLogin.status < 400 && memberLogin.signedIn, `status ${memberLogin.status}`);

const memberAdmin = await fetch(`${BASE}/admin`, { headers: { cookie: memberLogin.cookies }, redirect: "manual" });
check("non-admin bounced from /admin", memberAdmin.status === 307 || memberAdmin.status === 302, `status ${memberAdmin.status}`);

const badPin = await login({ publicId: ADMIN.publicId, pin: "000000" });
check("wrong PIN rejected", !badPin.signedIn);

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

// Throwaway account for the lockout test.
await client.query(
  `INSERT INTO users (public_id, name, pin_hash, is_admin, status)
   VALUES ($1, 'Lockout Test', $2, false, 'active')
   ON CONFLICT (public_id) DO UPDATE
     SET pin_hash = EXCLUDED.pin_hash, failed_attempts = 0, locked_until = NULL, status = 'active'`,
  [LOCKOUT_ID, await bcrypt.hash("999999", 10)],
);
for (let attempt = 0; attempt < 5; attempt += 1) {
  await login({ publicId: LOCKOUT_ID, pin: "111111" });
}
const locked = await client.query("SELECT locked_until FROM users WHERE public_id = $1", [LOCKOUT_ID]);
check("account locks after 5 failures", Boolean(locked.rows[0]?.locked_until));

const lockedLogin = await login({ publicId: LOCKOUT_ID, pin: "999999" });
check("correct PIN refused while locked", !lockedLogin.signedIn);
await client.query(
  "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE public_id = $1",
  [LOCKOUT_ID],
);

const seeded = await client.query(
  `SELECT u.id AS user_id, w.id AS workspace_id
     FROM users u
     JOIN workspaces w ON w.owner_id = u.id
    WHERE u.public_id = $1
    ORDER BY w.created_at ASC
    LIMIT 1`,
  [ADMIN.publicId],
);
if (seeded.rows.length === 0) throw new Error("run `npm run seed:dev` first");
const { user_id: userId, workspace_id: workspaceId } = seeded.rows[0];
const room = `${workspaceId}:${today}`;

const tokenResponse = await fetch(`${BASE}/api/collab-token?room=${encodeURIComponent(room)}`, {
  headers: { cookie: adminLogin.cookies },
});
const tokenBody = await tokenResponse.json();
check("collab token endpoint", tokenResponse.status === 200 && typeof tokenBody.token === "string", `status ${tokenResponse.status}`);

const forbidden = await fetch(
  `${BASE}/api/collab-token?room=${encodeURIComponent("00000000-0000-4000-8000-000000000000:" + today)}`,
  { headers: { cookie: adminLogin.cookies } },
);
check("collab token rejects foreign workspace", forbidden.status === 403, `status ${forbidden.status}`);

// Mirrors src/lib/collab-token.ts: the token names the room it was minted for.
const minted = await new SignJWT({ wid: workspaceId, room, name: "Smoke Tester", color: "#7c8cff" })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(userId)
  .setIssuer("daystream")
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(SECRET));

function connect(doc) {
  const provider = new HocuspocusProvider({
    url: WS_URL,
    name: room,
    token: minted,
    document: doc,
    WebSocketPolyfill: WebSocket,
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("websocket sync timeout")), 10_000);
    provider.on("synced", () => {
      clearTimeout(timer);
      resolve(provider);
    });
    provider.on("authenticationFailed", () => {
      clearTimeout(timer);
      reject(new Error("authentication failed"));
    });
  });
}

const docA = new Y.Doc();
const providerA = await connect(docA);
check("websocket authenticated + synced", true);

// The same token must not open a sibling room.
const crossRoomDoc = new Y.Doc();
const crossRoomRejected = await new Promise((resolve) => {
  const provider = new HocuspocusProvider({
    url: WS_URL,
    name: `${workspaceId}:backlog`,
    token: minted,
    document: crossRoomDoc,
    WebSocketPolyfill: WebSocket,
  });
  const timer = setTimeout(() => {
    provider.destroy();
    resolve(false);
  }, 6000);
  provider.on("authenticationFailed", () => {
    clearTimeout(timer);
    provider.destroy();
    resolve(true);
  });
});
check("collab token is bound to its room", crossRoomRejected);

const blocks = docA.getArray("blocks");
const makeBlock = (id, content, type = "text") => {
  const map = new Y.Map();
  map.set("id", id);
  map.set("type", type);
  map.set("content", content);
  map.set("done", false);
  map.set("createdAt", Date.now());
  map.set("createdBy", userId);
  return map;
};
const idA = crypto.randomUUID();
const idB = crypto.randomUUID();
docA.transact(() => {
  blocks.push([
    makeBlock(idA, "Conveyor line B jamming during shift."),
    makeBlock(idB, "Call about replacement part order.", "todo"),
  ]);
});
check("blocks written to local doc", blocks.length >= 2, `${blocks.length} blocks`);

await new Promise((resolve) => setTimeout(resolve, 3000));

const stored = await client.query("SELECT length(state) AS bytes FROM yjs_documents WHERE room_name = $1", [room]);
check("yjs document persisted", stored.rows.length === 1 && Number(stored.rows[0].bytes) > 0, stored.rows[0] ? `${stored.rows[0].bytes} bytes` : "missing");

const projected = await client.query(
  "SELECT id, type, content FROM things WHERE workspace_id = $1 AND room_date = $2 ORDER BY sort_order",
  [workspaceId, today],
);
check("SQL projection of blocks", projected.rows.length >= 2 && projected.rows.some((row) => row.type === "todo"), `${projected.rows.length} rows`);

const docB = new Y.Doc();
const providerB = await connect(docB);
await new Promise((resolve) => setTimeout(resolve, 800));
check("second client receives blocks", docB.getArray("blocks").length >= 2, `${docB.getArray("blocks").length} blocks`);

const badProviderDoc = new Y.Doc();
let rejected = false;
const badProvider = new HocuspocusProvider({
  url: WS_URL,
  name: room,
  token: "not-a-real-token",
  document: badProviderDoc,
  WebSocketPolyfill: WebSocket,
});
await new Promise((resolve) => {
  const timer = setTimeout(resolve, 3000);
  const done = () => {
    clearTimeout(timer);
    rejected = true;
    resolve();
  };
  badProvider.on("authenticationFailed", done);
  badProvider.on("disconnect", done);
});
check("websocket rejects bad token", rejected || badProviderDoc.getArray("blocks").length === 0);

const searchResponse = await fetch(`${BASE}/api/search?q=Conveyor`, {
  headers: { cookie: adminLogin.cookies },
});
const searchBody =
  searchResponse.status === 200 ? await searchResponse.json().catch(() => ({ hits: [] })) : { hits: [] };
check(
  "inline search finds the projected Thing",
  searchResponse.status === 200 &&
    (searchBody.hits ?? []).some((hit) => String(hit.content ?? "").includes("Conveyor")),
  `status ${searchResponse.status}`,
);

const oldDayRoute = await fetch(`${BASE}/app/${today}`, {
  headers: { cookie: adminLogin.cookies },
  redirect: "manual",
});
check(
  "old day route lands on the one view",
  oldDayRoute.status === 307 || oldDayRoute.status === 308,
  `status ${oldDayRoute.status}`,
);

providerB.destroy();
providerA.destroy();
badProvider.destroy();
await client.end();

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
