import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer } from "ws";
import { api } from "./api.mjs";
import { closeCollab, hocuspocus } from "./collab.mjs";
import { pool } from "./db.mjs";
import { ensureSchema, migrate } from "./migrate.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Local convenience: `.env.local` (ignored) then `.env`. Railway injects its own
// variables, and an explicitly exported value always wins.
for (const file of [".env.local", ".env"]) {
  const full = path.join(root, file);
  if (existsSync(full) && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(full);
    } catch {
      /* malformed env files should not stop the boot */
    }
  }
}

const dev = process.argv.includes("--dev");
const port = Number(process.env.PORT || 3000);
const host = "0.0.0.0";
const distDir = path.join(root, "dist");

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
  console.error("[boot] AUTH_SECRET must be set to at least 16 characters.");
  process.exit(1);
}

await migrate();

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});
app.use("/api", api);

const server = createServer(app);

if (dev) {
  const { createServer: createViteServer } = await import("vite");
  const allowedHosts = (process.env.PREVIEW_HOSTNAME ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const vite = await createViteServer({
    root,
    appType: "spa",
    server: {
      middlewareMode: true,
      hmr: { server },
      allowedHosts,
    },
  });
  app.use(vite.middlewares);
} else {
  if (!existsSync(path.join(distDir, "index.html"))) {
    console.error("[boot] dist/index.html is missing — run `npm run build` first.");
    process.exit(1);
  }
  const indexHtml = path.join(distDir, "index.html");
  app.use(
    "/assets",
    express.static(path.join(distDir, "assets"), {
      immutable: true,
      maxAge: "1y",
    }),
  );
  app.use(express.static(distDir, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtml);
  });
  app.use((req, res) => {
    res.status(404).json({ error: "not_found" });
  });
}

app.use(async (error, req, res, next) => {
  if (res.headersSent) return next(error);

  // A wiped database volume leaves the process connected to an empty schema.
  // Migrations normally run at boot; repair once here, then replay the request.
  if (error?.code === "42P01" && !req.schemaChecked) {
    req.schemaChecked = true;
    try {
      await ensureSchema();
      // The API router is mounted at /api, so the replay needs the prefix
      // stripped exactly as Express does for the first pass.
      req.url = req.originalUrl.startsWith("/api")
        ? req.originalUrl.slice(4) || "/"
        : req.originalUrl;
      api(req, res, (retryError) => {
        if (!retryError) return;
        console.error("[http]", retryError);
        if (!res.headersSent) res.status(500).json({ error: "server_error" });
      });
      return;
    } catch (repairError) {
      console.error("[db] schema repair failed:", repairError);
    }
  }

  console.error("[http]", error);
  res.status(500).json({ error: "server_error" });
});

/*
 * One process, one port: Yjs sync, awareness presence and the HTTP API share
 * the same listener. Railway routes a single public port, and this keeps the
 * sockets on the same origin as the page (no extra realtime service).
 */
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  let pathname = "";
  try {
    pathname = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
      .pathname;
  } catch {
    return;
  }
  // Leave every other upgrade (Vite's HMR socket in development) alone.
  if (pathname !== "/collab") return;

  try {
    wss.handleUpgrade(req, socket, head, (ws) => {
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

server.listen(port, host, () => {
  console.log(`> Daystream on http://${host}:${port} (${dev ? "development" : "production"})`);
  console.log("> Realtime: /collab");
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} received, shutting down`);
  wss.close();
  server.close();
  await closeCollab().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
