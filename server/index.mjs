import { createServer } from "node:http";
import next from "next";
import { WebSocketServer } from "ws";
import { hocuspocus, closeCollab } from "./collab.mjs";
import { migrate } from "./migrate.mjs";

const dev = process.argv.includes("--dev") || process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOSTNAME || "0.0.0.0";

await migrate({ log: (line) => console.log(line) });

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
await app.prepare();

const server = createServer((req, res) => {
  handle(req, res);
});

// One process, one port: Hocuspocus WebSockets live at /collab next to Next.
// Next's own dev HMR socket also upgrades on this server, so unknown paths are
// left alone for its listener.
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  let pathname = "";
  try {
    pathname = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`).pathname;
  } catch {
    return;
  }
  if (pathname !== "/collab") return;
  if (process.env.DEBUG_WS) console.log("[collab] upgrade requested", req.url);

  try {
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (process.env.DEBUG_WS) console.log("[collab] socket open");

      // Hocuspocus 4 hands back a ClientConnection and expects the host server
      // to pump socket events into it (its own Server does this via crossws).
      const connection = hocuspocus.handleConnection(ws, req);

      ws.on("message", (data) => {
        try {
          const bytes = Buffer.isBuffer(data)
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : new Uint8Array(data);
          connection.handleMessage(bytes);
        } catch (error) {
          console.error("[collab] message failed", error);
        }
      });

      ws.on("pong", () => connection.touch());

      ws.on("close", (code, reason) => {
        if (process.env.DEBUG_WS) console.log("[collab] socket closed", code);
        try {
          connection.handleClose({
            code,
            reason: Buffer.isBuffer(reason) ? reason.toString() : String(reason ?? ""),
          });
        } catch (error) {
          console.error("[collab] close failed", error);
        }
      });

      ws.on("error", (error) => console.error("[collab] socket error", error));
    });
  } catch (error) {
    console.error("[collab] upgrade failed", error);
    socket.destroy();
  }
});

server.listen(port, hostname, () => {
  console.log(
    `> Daystream listening on http://${hostname}:${port} (${dev ? "development" : "production"})`,
  );
  console.log(`> Realtime endpoint: /collab`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} received, shutting down`);
  wss.close();
  server.close();
  try {
    await closeCollab();
  } catch {
    // ignore
  }
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
