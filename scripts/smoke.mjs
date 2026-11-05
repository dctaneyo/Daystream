import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";

const base = process.env.SMOKE_URL ?? "http://127.0.0.1:3000";
const wsUrl = base.replace(/^http/, "ws") + "/collab";

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`✓ ${name}`);
    return;
  }
  failed += 1;
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function localDateKey() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

class Jar {
  constructor() {
    this.cookies = new Map();
  }

  absorb(response) {
    const list =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    for (const entry of list) {
      const [pair] = entry.split(";");
      const index = pair.indexOf("=");
      if (index === -1) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
  }

  header() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

async function call(jar, path, options = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(jar ? { cookie: jar.header() } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
  });
  jar?.absorb(response);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

function waitForSync(provider) {
  return new Promise((resolve, reject) => {
    if (provider.isSynced) {
      resolve();
      return;
    }
    const timer = setTimeout(() => reject(new Error("collab sync timed out")), 10_000);
    provider.on("synced", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function connect(room, token, doc) {
  const provider = new HocuspocusProvider({
    url: wsUrl,
    name: room,
    document: doc,
    token,
    WebSocketPolyfill: WebSocket,
  });
  provider.on("authenticationFailed", () => {
    console.error("[smoke] provider authentication failed", room);
  });
  await waitForSync(provider);
  return provider;
}

function writeLine(doc, text) {
  const paragraph = new Y.XmlElement("paragraph");
  paragraph.insert(0, [new Y.XmlText(text)]);
  doc.getXmlFragment("default").insert(doc.getXmlFragment("default").length, [paragraph]);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const date = localDateKey();
const jarA = new Jar();

try {
  const health = await call(null, "/health");
  check("health endpoint", health.status === 200 && health.data.ok === true);

  const registered = await call(jarA, "/auth/register", {
    method: "POST",
    body: { pin: "482913" },
  });
  assert(registered.status === 201, `register returned ${registered.status}`);
  const userIdA = registered.data.user.userId;
  const workspaceId = registered.data.workspace.id;
  check("account created with a six-digit ID", /^\d{6}$/.test(userIdA), userIdA);

  const me = await call(jarA, "/me");
  check("session cookie authenticates /me", me.status === 200 && me.data.user.userId === userIdA);

  const created = await call(jarA, "/notes", {
    method: "POST",
    body: { assignedDate: date, workspaceId },
  });
  assert(created.status === 201, `create note returned ${created.status}`);
  const noteId = created.data.id;

  let bootstrap = await call(
    jarA,
    `/bootstrap?date=${date}&from=${date}&to=${date}&workspace=${workspaceId}`,
  );
  check(
    "new note appears in its day",
    bootstrap.status === 200 && bootstrap.data.day.notes.some((note) => note.id === noteId),
  );

  const pinnedDay = await call(jarA, `/notes/${noteId}`, {
    method: "PATCH",
    body: { pinMode: "day" },
  });
  check(
    "day pin takes the first rank",
    pinnedDay.status === 200 &&
      pinnedDay.data.pinMode === "day" &&
      pinnedDay.data.sortOrder < 0,
    String(pinnedDay.data.sortOrder),
  );

  bootstrap = await call(
    jarA,
    `/bootstrap?date=${date}&from=${date}&to=${date}&workspace=${workspaceId}`,
  );
  check(
    "day-pinned note sorts first",
    bootstrap.data.day.notes[0]?.id === noteId && bootstrap.data.day.notes[0]?.pinMode === "day",
  );

  const held = await call(jarA, `/notes/${noteId}`, {
    method: "PATCH",
    body: { pinMode: "global" },
  });
  check("global pin accepted", held.status === 200 && held.data.pinMode === "global");

  bootstrap = await call(
    jarA,
    `/bootstrap?date=${date}&from=${date}&to=${date}&workspace=${workspaceId}`,
  );
  check(
    "held note leaves the day and enters the tray",
    bootstrap.data.pinned.some((note) => note.id === noteId) &&
      !bootstrap.data.day.notes.some((note) => note.id === noteId),
  );

  const unpinned = await call(jarA, `/notes/${noteId}`, {
    method: "PATCH",
    body: { pinMode: "none" },
  });
  check("note can be released", unpinned.status === 200 && unpinned.data.pinMode === "none");

  const token = await call(jarA, `/collab/token?noteId=${noteId}`);
  check(
    "solo note gets the private channel",
    token.status === 200 && token.data.room === `private-${noteId}`,
    token.data.room,
  );

  const docA = new Y.Doc();
  let providerA = await connect(token.data.room, token.data.token, docA);
  writeLine(docA, "Smoke note");
  await sleep(3000);

  bootstrap = await call(
    jarA,
    `/bootstrap?date=${date}&from=${date}&to=${date}&workspace=${workspaceId}`,
  );
  check(
    "Yjs content is stored and projected into the list",
    bootstrap.data.day.notes.some((note) => note.id === noteId && note.title === "Smoke note"),
    JSON.stringify(bootstrap.data.day.notes[0] ?? null),
  );

  const registeredB = await call(new Jar(), "/auth/register", {
    method: "POST",
    body: { pin: "913847" },
  });
  assert(registeredB.status === 201, "second account failed");
  const userIdB = registeredB.data.user.userId;
  const jarB = new Jar();
  const loginB = await call(jarB, "/auth/login", {
    method: "POST",
    body: { userId: userIdB, pin: "913847" },
  });
  assert(loginB.status === 200, "second account login failed");

  const invite = await call(jarA, `/workspaces/${workspaceId}/members`, {
    method: "POST",
    body: { userId: userIdB, role: "editor" },
  });
  check("workspace invite succeeds", invite.status === 200 && invite.data.userId === userIdB);

  const tokenA2 = await call(jarA, `/collab/token?noteId=${noteId}`);
  const tokenB = await call(jarB, `/collab/token?noteId=${noteId}`);
  check(
    "shared workspace switches to the shared channel",
    tokenA2.data.room === `shared-${workspaceId}-${noteId}` &&
      tokenB.data.room === tokenA2.data.room,
    tokenA2.data.room,
  );

  providerA.destroy();
  docA.destroy();

  const docA2 = new Y.Doc();
  const docB = new Y.Doc();
  providerA = await connect(tokenA2.data.room, tokenA2.data.token, docA2);
  const providerB = await connect(tokenB.data.room, tokenB.data.token, docB);
  await sleep(500);

  check(
    "a second member receives the stored document",
    docB.getXmlFragment("default").toString().includes("Smoke note"),
    docB.getXmlFragment("default").toString(),
  );

  writeLine(docB, "B was here");
  await sleep(800);
  check(
    "edits flow between open sockets",
    docA2.getXmlFragment("default").toString().includes("B was here"),
  );

  const presenceToken = await call(jarA, `/collab/token?workspaceId=${workspaceId}`);
  check(
    "presence uses its own workspace channel",
    presenceToken.data.room === `presence-${workspaceId}`,
  );

  const presenceDocA = new Y.Doc();
  const presenceDocB = new Y.Doc();
  const presenceA = await connect(presenceToken.data.room, presenceToken.data.token, presenceDocA);
  const presenceB = await connect(presenceToken.data.room, presenceToken.data.token, presenceDocB);
  presenceA.awareness.setLocalStateField("footprint", { date, noteId });
  await sleep(600);
  const states = [...presenceB.awareness.getStates().values()];
  check(
    "footprint presence travels over awareness",
    states.some((state) => state.footprint?.date === date),
  );

  const outsiderJar = new Jar();
  const outsider = await call(outsiderJar, "/auth/register", {
    method: "POST",
    body: { pin: "556677" },
  });
  assert(outsider.status === 201, "third account failed");
  const outsiderToken = await call(outsiderJar, `/collab/token?noteId=${noteId}`);
  check("outsiders cannot mint a token for a note", outsiderToken.status === 404);
  const outsiderPresence = await call(
    outsiderJar,
    `/collab/token?workspaceId=${workspaceId}`,
  );
  check("outsiders cannot join workspace presence", outsiderPresence.status === 404);
  const outsiderDelete = await call(outsiderJar, `/notes/${noteId}`, { method: "DELETE" });
  check("outsiders cannot delete a note", outsiderDelete.status === 404);

  const refreshed = await call(jarB, "/auth/refresh", { method: "POST" });
  check("refresh rotates the access token", refreshed.status === 204);

  const wrongUnlock = await call(jarB, "/auth/unlock", {
    method: "POST",
    body: { pin: "000000" },
  });
  check("wrong PIN is refused", wrongUnlock.status === 401);

  const unlock = await call(jarB, "/auth/unlock", {
    method: "POST",
    body: { pin: "913847" },
  });
  check("PIN unlock resumes the session", unlock.status === 200 && unlock.data.session.endsAt > Date.now());

  const afterUnlock = await call(jarB, "/me");
  check("unlocked session still reads", afterUnlock.status === 200);

  const loggedOut = await call(jarB, "/auth/logout", { method: "POST" });
  const afterLogout = await call(jarB, "/me");
  check("logout clears the session", loggedOut.status === 204 && afterLogout.status === 401);

  providerA.destroy();
  providerB.destroy();
  presenceA.destroy();
  presenceB.destroy();
  presenceDocA.destroy();
  presenceDocB.destroy();
  docA2.destroy();
  docB.destroy();
} catch (error) {
  failed += 1;
  console.error(`✗ smoke run aborted — ${error.message}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
