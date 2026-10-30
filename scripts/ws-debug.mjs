import { SignJWT } from "jose";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import pg from "pg";

/** Manual realtime probe: `node scripts/ws-debug.mjs <workspaceId> [date]` */
const workspaceId = process.argv[2];
const date = process.argv[3] || new Date().toISOString().slice(0, 10);
if (!workspaceId) throw new Error("usage: node scripts/ws-debug.mjs <workspaceId> [date]");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const owner = await client.query(
  "SELECT owner_id FROM workspaces WHERE id = $1",
  [workspaceId],
);
await client.end();
if (owner.rows.length === 0) throw new Error("workspace not found");
const userId = owner.rows[0].owner_id;

const room = `${workspaceId}:${date}`;
const token = await new SignJWT({ wid: workspaceId, name: "WS Debug", color: "#7c8cff" })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(userId)
  .setIssuer("daystream")
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.AUTH_SECRET));

const doc = new Y.Doc();
const provider = new HocuspocusProvider({
  url: process.env.WS_URL || "ws://127.0.0.1:3000/collab",
  name: room,
  token,
  document: doc,
  WebSocketPolyfill: WebSocket,
});

for (const event of ["connect", "synced", "status", "authenticationFailed", "close", "disconnect", "message", "error"]) {
  provider.on(event, (...args) => {
    let detail = "";
    try {
      detail = JSON.stringify(args);
    } catch {
      detail = "<unserialisable>";
    }
    console.log(`[event] ${event} ${detail}`);
  });
}

await new Promise((resolve) => setTimeout(resolve, 5000));
console.log(
  "isConnected:",
  provider.isConnected,
  "blocks:",
  doc.getArray("blocks").length,
  "awareness:",
  provider.awareness?.getStates().size ?? 0,
);
provider.destroy();
doc.destroy();
process.exit(0);
