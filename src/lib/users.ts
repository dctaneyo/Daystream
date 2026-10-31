import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { randomPublicId } from "@/lib/pin";

export type AdminUser = {
  id: string;
  publicId: string;
  name: string;
  email: string | null;
  isAdmin: boolean;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  workspaceCount: number;
  thingCount: number;
};

type UserRow = {
  id: string;
  public_id: string;
  name: string | null;
  email: string | null;
  is_admin: boolean;
  status: string;
  created_at: Date;
  last_login_at: Date | null;
  workspace_count: string;
  thing_count: string;
};

export async function listUsersForAdmin(term = "", limit = 200): Promise<AdminUser[]> {
  const { rows } = await query<UserRow>(
    `SELECT u.id,
            u.public_id,
            u.name,
            u.email,
            u.is_admin,
            u.status,
            u.created_at,
            u.last_login_at,
            (SELECT count(*) FROM workspace_members m WHERE m.user_id = u.id) AS workspace_count,
            (SELECT count(*) FROM things t WHERE t.created_by = u.id)     AS thing_count
       FROM users u
      WHERE $1 = ''
         OR u.public_id ILIKE '%' || $1 || '%'
         OR u.name ILIKE '%' || $1 || '%'
         OR coalesce(u.email, '') ILIKE '%' || $1 || '%'
      ORDER BY u.created_at DESC
      LIMIT $2`,
    [term.trim(), limit],
  );
  return rows.map((row) => ({
    id: row.id,
    publicId: row.public_id,
    name: row.name ?? `User ${row.public_id}`,
    email: row.email,
    isAdmin: row.is_admin,
    status: row.status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    workspaceCount: Number(row.workspace_count),
    thingCount: Number(row.thing_count),
  }));
}

export async function createUserRecord(input: {
  name: string;
  email?: string | null;
  pin: string;
  isAdmin: boolean;
  createdBy?: string | null;
  /** Admin-chosen ID. Falls back to a random one when omitted. */
  publicId?: string | null;
}): Promise<{ id: string; publicId: string }> {
  const pinHash = await bcrypt.hash(input.pin, 10);
  const requested = input.publicId?.trim();

  const insert = async (publicId: string) => {
    const { rows } = await query<{ id: string; public_id: string }>(
      `INSERT INTO users (public_id, name, email, pin_hash, is_admin, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, public_id`,
      [publicId, input.name, input.email ?? null, pinHash, input.isAdmin, input.createdBy ?? null],
    );
    return { id: rows[0]!.id, publicId: rows[0]!.public_id };
  };

  if (requested) {
    try {
      return await insert(requested);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new Error(`ID ${requested} is already taken.`);
      }
      throw error;
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await insert(randomPublicId());
    } catch (error) {
      if ((error as { code?: string }).code === "23505") continue;
      throw error;
    }
  }
  throw new Error("Unable to allocate a unique 6-digit ID — try again.");
}

export async function setUserPublicId(userId: string, publicId: string): Promise<void> {
  await query("UPDATE users SET public_id = $2 WHERE id = $1", [userId, publicId]);
}

export async function setUserPin(userId: string, pin: string): Promise<void> {
  const hash = await bcrypt.hash(pin, 10);
  await query(
    "UPDATE users SET pin_hash = $2, failed_attempts = 0, locked_until = NULL WHERE id = $1",
    [userId, hash],
  );
}

export async function verifyUserPin(userId: string, pin: string): Promise<boolean> {
  const { rows } = await query<{ pin_hash: string | null }>(
    "SELECT pin_hash FROM users WHERE id = $1",
    [userId],
  );
  const hash = rows[0]?.pin_hash;
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}

export async function setUserStatus(userId: string, status: "active" | "suspended"): Promise<void> {
  await query("UPDATE users SET status = $2 WHERE id = $1", [userId, status]);
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  await query("UPDATE users SET is_admin = $2 WHERE id = $1", [userId, isAdmin]);
}

export async function deleteUser(userId: string): Promise<void> {
  await query("DELETE FROM users WHERE id = $1", [userId]);
}

export async function countAdmins(): Promise<number> {
  const { rows } = await query<{ count: string }>(
    "SELECT count(*)::text AS count FROM users WHERE is_admin = true AND status = 'active'",
  );
  return Number(rows[0]?.count ?? "0");
}

export async function getAdminStats() {
  const { rows } = await query<{
    users: string;
    active_users: string;
    admins: string;
    suspended: string;
    workspaces: string;
    things: string;
    things_today: string;
    documents: string;
  }>(
    `SELECT
       (SELECT count(*) FROM users)                                 AS users,
       (SELECT count(*) FROM users WHERE status = 'active')         AS active_users,
       (SELECT count(*) FROM users WHERE is_admin)                  AS admins,
       (SELECT count(*) FROM users WHERE status <> 'active')        AS suspended,
       (SELECT count(*) FROM workspaces)                            AS workspaces,
       (SELECT count(*) FROM things)                                AS things,
       (SELECT count(*) FROM things WHERE room_date = CURRENT_DATE)  AS things_today,
       (SELECT count(*) FROM yjs_documents)                         AS documents`,
  );
  const row = rows[0]!;
  return {
    users: Number(row.users),
    activeUsers: Number(row.active_users),
    admins: Number(row.admins),
    suspended: Number(row.suspended),
    workspaces: Number(row.workspaces),
    things: Number(row.things),
    thingsToday: Number(row.things_today),
    documents: Number(row.documents),
  };
}

export type AuditEntry = {
  id: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: Date;
  actorPublicId: string | null;
  actorName: string | null;
  targetPublicId: string | null;
  targetName: string | null;
};

export async function listAuditLog(limit = 100): Promise<AuditEntry[]> {
  const { rows } = await query<{
    id: string;
    action: string;
    details: Record<string, unknown>;
    created_at: Date;
    actor_public_id: string | null;
    actor_name: string | null;
    target_public_id: string | null;
    target_name: string | null;
  }>(
    `SELECT a.id, a.action, a.details, a.created_at,
            actor.public_id  AS actor_public_id,
            actor.name       AS actor_name,
            target.public_id AS target_public_id,
            target.name      AS target_name
       FROM admin_audit_log a
       LEFT JOIN users actor  ON actor.id = a.actor_id
       LEFT JOIN users target ON target.id = a.target_user_id
      ORDER BY a.created_at DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    details: row.details ?? {},
    createdAt: row.created_at,
    actorPublicId: row.actor_public_id,
    actorName: row.actor_name,
    targetPublicId: row.target_public_id,
    targetName: row.target_name,
  }));
}

export async function writeAudit(
  actorId: string,
  action: string,
  targetUserId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  await query(
    "INSERT INTO admin_audit_log (actor_id, action, target_user_id, details) VALUES ($1, $2, $3, $4::jsonb)",
    [actorId, action, targetUserId, JSON.stringify(details)],
  );
}
