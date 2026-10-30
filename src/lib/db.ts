import { Pool } from "pg";

const globalForDb = globalThis as unknown as { __daystreamPool?: Pool };

export const pool: Pool =
  globalForDb.__daystreamPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__daystreamPool = pool;
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<{ rows: T[]; rowCount: number | null }> {
  const result = await pool.query(text, values);
  return { rows: result.rows as T[], rowCount: result.rowCount };
}
