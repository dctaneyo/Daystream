import pg from "pg";

const connectionString = process.env.DATABASE_URL;

// `date` columns come back as plain YYYY-MM-DD strings, so a note's day never
// shifts with the server's timezone.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (error) => {
  console.error("[db] idle client error:", error.message);
});

export const query = (text, params) => pool.query(text, params);
