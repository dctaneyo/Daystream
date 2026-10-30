import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdir } from "node:fs/promises";

/**
 * Local-only Postgres. Railway provides a real Postgres plugin; this keeps
 * `npm run dev` dependency-free on a laptop by serving the Postgres wire
 * protocol from PGlite (WASM).
 */
const port = Number(process.env.PGLITE_PORT || 5432);
const dataDir = process.env.PGLITE_DIR || "./.pgdata";

await mkdir(dataDir, { recursive: true });
const db = await PGlite.create({ dataDir });
// maxConnections must cover the Next pool + the collab pool.
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 20 });

await server.start();
console.log(`[dev-db] PGlite (Postgres) listening on 127.0.0.1:${port}, data in ${dataDir}`);
console.log(`[dev-db] DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
