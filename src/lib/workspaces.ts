import { cookies } from "next/headers";
import { query } from "@/lib/db";

export const ACTIVE_WORKSPACE_COOKIE = "daystream_workspace";

export type Workspace = {
  id: string;
  name: string;
  role: string;
};

export async function listWorkspaces(userId: string): Promise<Workspace[]> {
  const { rows } = await query<Workspace>(
    `SELECT w.id, w.name, m.role
       FROM workspaces w
       JOIN workspace_members m ON m.workspace_id = w.id
      WHERE m.user_id = $1
      ORDER BY w.created_at ASC`,
    [userId],
  );
  return rows;
}

export async function requireMembership(
  userId: string,
  workspaceId: string,
): Promise<Workspace | null> {
  const { rows } = await query<Workspace>(
    `SELECT w.id, w.name, m.role
       FROM workspaces w
       JOIN workspace_members m ON m.workspace_id = w.id
      WHERE w.id = $1 AND m.user_id = $2`,
    [workspaceId, userId],
  );
  return rows[0] ?? null;
}

export async function createWorkspace(userId: string, name: string): Promise<Workspace> {
  const { rows } = await query<{ id: string; name: string }>(
    "INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING id, name",
    [name, userId],
  );
  const workspace = rows[0];
  await query(
    "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING",
    [workspace.id, userId],
  );
  return { id: workspace.id, name: workspace.name, role: "owner" };
}

/**
 * Resolves the workspace the user is currently looking at: the cookie if they
 * are still a member, otherwise their oldest membership. Brand-new accounts get
 * a "Personal" workspace so the daily canvas is never empty.
 */
export async function resolveActiveWorkspace(userId: string): Promise<Workspace> {
  const workspaces = await listWorkspaces(userId);
  if (workspaces.length === 0) {
    return createWorkspace(userId, "Personal");
  }

  const store = await cookies();
  const requested = store.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const match = requested ? workspaces.find((w) => w.id === requested) : undefined;
  return match ?? workspaces[0]!;
}
