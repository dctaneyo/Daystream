import bcrypt from "bcryptjs";
import pg from "pg";

/**
 * Local-only seed. Creates an admin (ID 100001 / PIN 123456) plus a second
 * non-admin account (ID 100002 / PIN 654321) for permission checks.
 * Never run this against production.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const client = new pg.Client({ connectionString });
await client.connect();

async function upsertUser({ publicId, name, email, pin, isAdmin, createdBy = null, workspace }) {
  const pinHash = await bcrypt.hash(pin, 10);
  const user = await client.query(
    `INSERT INTO users (public_id, name, email, pin_hash, is_admin, status, created_by, failed_attempts, locked_until)
     VALUES ($1, $2, $3, $4, $5, 'active', $6, 0, NULL)
     ON CONFLICT (public_id) DO UPDATE
       SET name = EXCLUDED.name,
           email = EXCLUDED.email,
           pin_hash = EXCLUDED.pin_hash,
           is_admin = EXCLUDED.is_admin,
           status = 'active',
           failed_attempts = 0,
           locked_until = NULL
     RETURNING id`,
    [publicId, name, email, pinHash, isAdmin, createdBy],
  );
  const userId = user.rows[0].id;

  const existing = await client.query(
    "SELECT id FROM workspaces WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1",
    [userId],
  );
  let workspaceId = existing.rows[0]?.id;
  if (!workspaceId) {
    const created = await client.query(
      "INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING id",
      [workspace, userId],
    );
    workspaceId = created.rows[0].id;
  }
  await client.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role)
     VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
    [workspaceId, userId],
  );

  return { userId, workspaceId };
}

const admin = await upsertUser({
  publicId: "100001",
  name: "Admin",
  email: "admin@daystream.dev",
  pin: "123456",
  isAdmin: true,
  workspace: "Work",
});

const member = await upsertUser({
  publicId: "100002",
  name: "Member",
  email: "member@daystream.dev",
  pin: "654321",
  isAdmin: false,
  createdBy: admin.userId,
  workspace: "Work",
});

console.log(
  JSON.stringify({
    admin: { publicId: "100001", pin: "123456", ...admin },
    member: { publicId: "100002", pin: "654321", ...member },
  }),
);

await client.end();
