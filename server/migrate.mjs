import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "db", "migrations");

export async function migrate({ log = console.log } = {}) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot run migrations.");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _daystream_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (await client.query("SELECT name FROM _daystream_migrations")).rows.map(
        (row) => row.name,
      ),
    );
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO _daystream_migrations (name) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        log(`[db] applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

/**
 * Re-apply migrations when the database was replaced underneath a running
 * process — a Railway volume wiped or recreated while the service stayed up.
 * Only heals a genuinely empty database: if the ledger survives, the schema is
 * assumed intentional and no destructive migration runs again.
 */
let ensuring = null;
export function ensureSchema() {
  if (ensuring) return ensuring;
  ensuring = (async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set.");
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      const { rows } = await client.query(`
        SELECT to_regclass('public.users') AS users,
               to_regclass('public._daystream_migrations') AS ledger
      `);
      if (rows[0].users || rows[0].ledger) return;
      console.warn("[db] schema missing under a running process; migrating");
      await migrate({ log: console.warn });
    } finally {
      await client.end();
    }
  })().finally(() => {
    ensuring = null;
  });
  return ensuring;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  migrate()
    .then(() => {
      console.log("[db] migrations up to date");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[db] migration failed:", error);
      process.exit(1);
    });
}
