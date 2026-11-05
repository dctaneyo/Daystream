import { HocuspocusProvider } from "@hocuspocus/provider";
import pg from "pg";
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

// Unique, real-shaped names keep repeated smoke runs from colliding on the
// display-name index. Each run registers fresh accounts anyway.
const suffix = Array.from({ length: 6 }, () =>
  String.fromCharCode(97 + Math.floor(Math.random() * 26)),
).join("");
const nameA = `Ada Lovelace ${suffix}`;
const nameB = `Grace Hopper ${suffix}`;
const nameC = `Alan Turing ${suffix}`;

async function makeOwner(userId) {
  assert(process.env.DATABASE_URL, "DATABASE_URL is required for admin smoke checks");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      "UPDATE users SET is_admin = TRUE, is_super_admin = TRUE WHERE user_id = $1",
      [userId],
    );
  } finally {
    await client.end();
  }
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
    body: { pin: "482913", displayName: nameA },
  });
  assert(registered.status === 201, `register returned ${registered.status}`);
  const userIdA = registered.data.user.userId;
  const workspaceId = registered.data.workspace.id;
  check("account created with a six-digit ID", /^\d{6}$/.test(userIdA), userIdA);
  check(
    "account carries its real display name",
    registered.data.user.displayName === nameA,
  );

  const duplicateName = await call(new Jar(), "/auth/register", {
    method: "POST",
    body: { pin: "111111", displayName: nameA.toUpperCase() },
  });
  check(
    "display names are unique regardless of case",
    duplicateName.status === 409 && duplicateName.data.error === "name_taken",
  );

  const invalidName = await call(new Jar(), "/auth/register", {
    method: "POST",
    body: { pin: "111111", displayName: "Ada 123" },
  });
  check(
    "display names reject handles and digits",
    invalidName.status === 400 && invalidName.data.error === "invalid_name",
  );

  const me = await call(jarA, "/me");
  check("session cookie authenticates /me", me.status === 200 && me.data.user.userId === userIdA);

  const renamed = await call(jarA, "/me", {
    method: "PATCH",
    body: { displayName: `${nameA} Renamed` },
  });
  check(
    "a member can change their display name",
    renamed.status === 200 && renamed.data.user.displayName === `${nameA} Renamed`,
  );
  const invalidRename = await call(jarA, "/me", {
    method: "PATCH",
    body: { displayName: "Ada 123" },
  });
  check(
    "display-name changes reject handles",
    invalidRename.status === 400 && invalidRename.data.error === "invalid_name",
  );
  const restoredName = await call(jarA, "/me", {
    method: "PATCH",
    body: { displayName: nameA },
  });
  check(
    "the restored display name is reflected back",
    restoredName.status === 200 && restoredName.data.user.displayName === nameA,
  );

  await makeOwner(userIdA);
  const ownerMe = await call(jarA, "/me");
  check("owner rights reach the session", ownerMe.data.user.isSuperAdmin === true);
  const ownerList = await call(jarA, "/admin/users");
  check(
    "the console lists accounts for the owner",
    ownerList.status === 200 &&
      ownerList.data.viewer.isSuperAdmin === true &&
      ownerList.data.users.some((user) => user.userId === userIdA),
  );

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
    body: { pin: "913847", displayName: nameB },
  });
  assert(registeredB.status === 201, "second account failed");
  const userIdB = registeredB.data.user.userId;
  const jarB = new Jar();
  const loginB = await call(jarB, "/auth/login", {
    method: "POST",
    body: { userId: userIdB, pin: "913847" },
  });
  assert(loginB.status === 200, "second account login failed");

  const bDenied = await call(jarB, "/admin/users");
  check("ordinary members cannot open the console", bDenied.status === 403);

  const promoted = await call(jarA, `/admin/users/${userIdB}/admin`, {
    method: "PATCH",
    body: { isAdmin: true },
  });
  check(
    "the owner can promote an administrator",
    promoted.status === 200 && promoted.data.user.isAdmin === true,
  );
  const bMeAdmin = await call(jarB, "/me");
  check(
    "promotion applies without a new token",
    bMeAdmin.data.user.isAdmin === true && bMeAdmin.data.user.isSuperAdmin === false,
  );
  const bList = await call(jarB, "/admin/users");
  check("administrators can list accounts", bList.status === 200);

  const bCannotPromote = await call(jarB, `/admin/users/${userIdA}/admin`, {
    method: "PATCH",
    body: { isAdmin: true },
  });
  check(
    "administrators cannot change administrator access",
    bCannotPromote.status === 403,
  );

  const bCannotEditAdmin = await call(jarB, `/admin/users/${userIdA}/id`, {
    method: "PATCH",
    body: { userId: "999998" },
  });
  check(
    "administrators cannot change another administrator's ID",
    bCannotEditAdmin.status === 403,
  );

  const demoted = await call(jarA, `/admin/users/${userIdB}/admin`, {
    method: "PATCH",
    body: { isAdmin: false },
  });
  check(
    "the owner can demote an administrator",
    demoted.status === 200 && demoted.data.user.isAdmin === false,
  );
  const bAfterDemote = await call(jarB, "/admin/users");
  check("demotion applies immediately", bAfterDemote.status === 403);

  const ownerDemote = await call(jarA, `/admin/users/${userIdA}/admin`, {
    method: "PATCH",
    body: { isAdmin: false },
  });
  check("the owner cannot be demoted", ownerDemote.status === 403);

  const selfId = await call(jarA, `/admin/users/${userIdA}/id`, {
    method: "PATCH",
    body: { userId: "999997" },
  });
  check("an administrator cannot change their own ID", selfId.status === 403);

  const invite = await call(jarA, `/workspaces/${workspaceId}/members`, {
    method: "POST",
    body: { identifier: nameB, role: "editor" },
  });
  check(
    "a workspace invite resolves a display name",
    invite.status === 200 &&
      invite.data.userId === userIdB &&
      invite.data.displayName === nameB,
  );

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
    body: { pin: "556677", displayName: nameC },
  });
  assert(outsider.status === 201, "third account failed");
  const userIdC = outsider.data.user.userId;
  const outsiderToken = await call(outsiderJar, `/collab/token?noteId=${noteId}`);
  check("outsiders cannot mint a token for a note", outsiderToken.status === 404);
  const outsiderPresence = await call(
    outsiderJar,
    `/collab/token?workspaceId=${workspaceId}`,
  );
  check("outsiders cannot join workspace presence", outsiderPresence.status === 404);
  const outsiderDelete = await call(outsiderJar, `/notes/${noteId}`, { method: "DELETE" });
  check("outsiders cannot delete a note", outsiderDelete.status === 404);

  const sharedDirectly = await call(jarA, `/notes/${noteId}/shares`, {
    method: "POST",
    body: { identifier: nameC, role: "editor" },
  });
  check(
    "a note can be shared with someone outside the workspace",
    sharedDirectly.status === 201 && sharedDirectly.data.userId === userIdC,
    JSON.stringify(sharedDirectly.data),
  );

  const shareList = await call(jarA, `/notes/${noteId}/shares`);
  check(
    "the note share list names the person",
    shareList.status === 200 &&
      shareList.data.shares.some((share) => share.userId === userIdC),
  );
  const shareeCannotManage = await call(outsiderJar, `/notes/${noteId}/shares`);
  check("a note sharee cannot manage the share list", shareeCannotManage.status === 403);

  const shareeToken = await call(outsiderJar, `/collab/token?noteId=${noteId}`);
  check(
    "a note sharee gets the note channel",
    shareeToken.status === 200 &&
      shareeToken.data.room === `shared-${workspaceId}-${noteId}`,
    JSON.stringify(shareeToken.data),
  );

  const shareeBootstrap = await call(
    outsiderJar,
    `/bootstrap?date=${date}&from=${date}&to=${date}&workspace=${outsider.data.workspace.id}`,
  );
  check(
    "the shared note appears in the sharee's shared tray",
    shareeBootstrap.status === 200 &&
      shareeBootstrap.data.shared.some((note) => note.id === noteId),
  );

  const shareePin = await call(outsiderJar, `/notes/${noteId}`, {
    method: "PATCH",
    body: { pinMode: "global" },
  });
  check("a note sharee cannot move or pin the note", shareePin.status === 403);
  const shareeDelete = await call(outsiderJar, `/notes/${noteId}`, { method: "DELETE" });
  check("a note sharee cannot delete the note", shareeDelete.status === 403);

  const memberShare = await call(jarA, `/notes/${noteId}/shares`, {
    method: "POST",
    body: { identifier: nameB },
  });
  check(
    "workspace members do not need a direct note share",
    memberShare.status === 409 && memberShare.data.error === "already_member",
  );
  const selfShare = await call(jarA, `/notes/${noteId}/shares`, {
    method: "POST",
    body: { identifier: nameA },
  });
  check("a note cannot be shared with its manager", selfShare.status === 400);

  const unshared = await call(jarA, `/notes/${noteId}/shares/${userIdC}`, {
    method: "DELETE",
  });
  const revokedToken = await call(outsiderJar, `/collab/token?noteId=${noteId}`);
  check(
    "removing a note share revokes the channel",
    unshared.status === 204 && revokedToken.status === 404,
  );

  const publicBefore = await call(jarA, `/notes/${noteId}/public`);
  check(
    "a note starts without a public link",
    publicBefore.status === 200 && publicBefore.data.enabled === false,
  );
  const publicCreated = await call(jarA, `/notes/${noteId}/public`, {
    method: "POST",
  });
  check(
    "a note manager can create a public link",
    publicCreated.status === 201 &&
      publicCreated.data.enabled === true &&
      /^[A-Za-z0-9_-]{32,64}$/.test(publicCreated.data.token),
    JSON.stringify(publicCreated.data),
  );

  const publicToken = publicCreated.data.token;
  const publicRead = await call(null, `/public/notes/${publicToken}`);
  check(
    "a public note can be read without a session",
    publicRead.status === 200 &&
      publicRead.data.note.title === "Smoke note" &&
      typeof publicRead.data.content === "string" &&
      publicRead.data.content.length > 0,
    JSON.stringify(publicRead.data),
  );
  const unknownPublic = await call(null, "/public/notes/not-a-real-token");
  check("an unknown public token stays closed", unknownPublic.status === 404);

  const publicOff = await call(jarA, `/notes/${noteId}/public`, {
    method: "DELETE",
  });
  const publicAfterOff = await call(null, `/public/notes/${publicToken}`);
  check(
    "turning off a public link revokes it immediately",
    publicOff.status === 204 && publicAfterOff.status === 404,
  );

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

  const takenId = await call(jarA, `/admin/users/${userIdC}/id`, {
    method: "PATCH",
    body: { userId: userIdB },
  });
  check(
    "an ID already in use cannot be assigned",
    takenId.status === 409 && takenId.data.error === "id_taken",
  );

  const jarB2 = new Jar();
  const loginB2 = await call(jarB2, "/auth/login", {
    method: "POST",
    body: { userId: userIdB, pin: "913847" },
  });
  assert(loginB2.status === 200, "second account could not sign in before the ID change");

  let nextIdB = "";
  do {
    nextIdB = String(100000 + Math.floor(Math.random() * 900000));
  } while (nextIdB === userIdA || nextIdB === userIdB || nextIdB === userIdC);

  const changedId = await call(jarA, `/admin/users/${userIdB}/id`, {
    method: "PATCH",
    body: { userId: nextIdB },
  });
  check(
    "the owner can change a member's ID",
    changedId.status === 200 && changedId.data.user.userId === nextIdB,
  );

  const staleId = await call(jarB2, "/me");
  check("the previous ID stops authenticating", staleId.status === 401);

  const jarB3 = new Jar();
  const relogin = await call(jarB3, "/auth/login", {
    method: "POST",
    body: { userId: nextIdB, pin: "913847" },
  });
  check("the new ID signs in", relogin.status === 200);

  const workspacesAfterRename = await call(jarB3, "/workspaces");
  check(
    "an ID change keeps workspace membership",
    workspacesAfterRename.status === 200 &&
      workspacesAfterRename.data.some((workspace) => workspace.id === workspaceId),
  );

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
