import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdir } from "node:fs/promises";

/**
 * Local-only Postgres. Railway provides a real Postgres plugin; this keeps
 * `npm run dev` dependency-free by serving the Postgres wire protocol from
 * PGlite (WASM).
 */
const port = Number(process.env.PGLITE_PORT || 5432);
const dataDir = process.env.PGLITE_DIR || "./.pgdata";

await mkdir(dataDir, { recursive: true });
const database = await PGlite.create({ dataDir });
const server = new PGLiteSocketServer({
  db: database,
  port,
  host: "127.0.0.1",
  maxConnections: 20,
});

await server.start();
console.log(`[dev-db] PGlite listening on 127.0.0.1:${port}, data in ${dataDir}`);
console.log(`[dev-db] DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);

const stop = async () => {
  await server.stop();
  await database.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
