import { query } from "@/lib/db";

/**
 * Notes are owned by a workspace but shared per note. Access is therefore two
 * different questions:
 *   - canManage: the caller belongs to the owning workspace (they may share)
 *   - visible:   the caller owns it *or* was explicitly added to the note
 */
export type NoteAccess = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  title: string;
  createdBy: string | null;
  canManage: boolean;
  sharedWithMe: boolean;
  isInbox: boolean;
};

export type NoteSummary = NoteAccess & {
  updatedAt: Date;
  memberCount: number;
  thingCount: number;
};

/** What the "Move to Note" picker needs, and nothing else. */
export type NoteChoice = { id: string; title: string };

export type NoteAccessWithInbox = NoteAccess & { isInbox: boolean };

type NoteRow = {
  id: string;
  workspace_id: string;
  workspace_name: string;
  title: string;
  created_by: string | null;
  updated_at: Date;
  member_count: string;
  thing_count: string;
  can_manage: boolean;
  is_inbox: boolean;
};

const VISIBLE = `(
  EXISTS (SELECT 1 FROM workspace_members wm
           WHERE wm.workspace_id = n.workspace_id AND wm.user_id = $1)
  OR EXISTS (SELECT 1 FROM note_members nm
              WHERE nm.note_id = n.id AND nm.user_id = $1)
)`;

export async function listNotes(userId: string, limit = 200): Promise<NoteSummary[]> {
  const { rows } = await query<NoteRow>(
    `SELECT n.id,
            n.workspace_id,
            w.name AS workspace_name,
            n.title,
            n.created_by,
            n.updated_at,
            n.is_inbox,
            (SELECT count(*) FROM note_members m WHERE m.note_id = n.id) AS member_count,
            (SELECT count(*) FROM things t WHERE t.note_id = n.id) AS thing_count,
            EXISTS (SELECT 1 FROM workspace_members wm
                     WHERE wm.workspace_id = n.workspace_id AND wm.user_id = $1) AS can_manage
       FROM notes n
       JOIN workspaces w ON w.id = n.workspace_id
      WHERE ${VISIBLE}
      ORDER BY n.is_inbox DESC, n.updated_at DESC
      LIMIT $2`,
    [userId, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    title: row.title,
    createdBy: row.created_by,
    canManage: row.can_manage,
    sharedWithMe: !row.can_manage,
    isInbox: row.is_inbox,
    updatedAt: row.updated_at,
    memberCount: Number(row.member_count),
    thingCount: Number(row.thing_count),
  }));
}

/**
 * The one view of the app: the Notes belonging to a day. Distinct from
 * `listNotes` on purpose — that one answers "what do I have", this answers
 * "what is today" (UX-23).
 */
export async function listNotesForDay(userId: string, day: string): Promise<NoteSummary[]> {
  const { rows } = await query<NoteRow>(
    `SELECT n.id,
            n.workspace_id,
            w.name AS workspace_name,
            n.title,
            n.created_by,
            n.updated_at,
            n.is_inbox,
            (SELECT count(*) FROM note_members m WHERE m.note_id = n.id) AS member_count,
            (SELECT count(*) FROM things t WHERE t.note_id = n.id) AS thing_count,
            EXISTS (SELECT 1 FROM workspace_members wm
                     WHERE wm.workspace_id = n.workspace_id AND wm.user_id = $1) AS can_manage
       FROM notes n
       JOIN workspaces w ON w.id = n.workspace_id
      WHERE n.day = $2::date AND ${VISIBLE}
      ORDER BY n.is_inbox DESC, n.created_at ASC`,
    [userId, day],
  );
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    title: row.title,
    createdBy: row.created_by,
    canManage: row.can_manage,
    sharedWithMe: !row.can_manage,
    isInbox: row.is_inbox,
    updatedAt: row.updated_at,
    memberCount: Number(row.member_count),
    thingCount: Number(row.thing_count),
  }));
}

export async function getNoteForUser(noteId: string, userId: string): Promise<NoteAccess | null> {
  const { rows } = await query<NoteRow>(
    `SELECT n.id,
            n.workspace_id,
            w.name AS workspace_name,
            n.title,
            n.created_by,
            n.updated_at,
            n.is_inbox,
            (SELECT count(*) FROM note_members m WHERE m.note_id = n.id) AS member_count,
            (SELECT count(*) FROM things t WHERE t.note_id = n.id) AS thing_count,
            EXISTS (SELECT 1 FROM workspace_members wm
                     WHERE wm.workspace_id = n.workspace_id AND wm.user_id = $1) AS can_manage
       FROM notes n
       JOIN workspaces w ON w.id = n.workspace_id
      WHERE n.id = $2 AND ${VISIBLE}`,
    [userId, noteId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    title: row.title,
    createdBy: row.created_by,
    canManage: row.can_manage,
    sharedWithMe: !row.can_manage,
    isInbox: row.is_inbox,
  };
}

export async function createNote(input: {
  userId: string;
  workspaceId: string;
  title: string;
  /** The day this Note belongs to; today when omitted. */
  day?: string;
}): Promise<{ id: string }> {
  const title = input.title.trim().slice(0, 120) || "Untitled note";
  const { rows } = await query<{ id: string }>(
    `INSERT INTO notes (workspace_id, title, created_by, day)
     SELECT $1, $2, $3, COALESCE($4::date, CURRENT_DATE)
      WHERE EXISTS (SELECT 1 FROM workspace_members
                     WHERE workspace_id = $1 AND user_id = $3)
     RETURNING id`,
    [input.workspaceId, title, input.userId, input.day ?? null],
  );
  const created = rows[0];
  if (!created) throw new Error("You are not a member of that workspace.");
  return created;
}

export async function renameNote(noteId: string, userId: string, title: string): Promise<void> {
  const next = title.trim().slice(0, 120);
  if (!next) return;
  await query(
    `UPDATE notes n SET title = $3, updated_at = now()
      WHERE n.id = $2
        AND EXISTS (SELECT 1 FROM workspace_members wm
                     WHERE wm.workspace_id = n.workspace_id AND wm.user_id = $1)`,
    [userId, noteId, next],
  );
}

export async function deleteNote(noteId: string, userId: string): Promise<void> {
  await query(
    `DELETE FROM notes n
      WHERE n.id = $2
        AND (n.created_by = $1
             OR EXISTS (SELECT 1 FROM workspace_members wm
                         WHERE wm.workspace_id = n.workspace_id AND wm.user_id = $1))`,
    [userId, noteId],
  );
}

/**
 * How many Things a Note holds, for the one confirmation that names a count.
 * Projection is asynchronous, so a freshly typed Note may legitimately report
 * zero — callers must phrase that as "unknown" rather than "empty" (UX-13).
 */
export async function countThingsInNote(noteId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    "SELECT count(*) AS count FROM things WHERE note_id = $1",
    [noteId],
  );
  return Number(rows[0]?.count ?? 0);
}

/** Notes a person can file a Thing into, Inbox first. */
export async function listNoteChoices(userId: string): Promise<NoteChoice[]> {
  const notes = await listNotes(userId);
  return notes.map((note) => ({ id: note.id, title: note.title }));
}

export type NoteMember = { userId: string; publicId: string; name: string };

export async function listNoteMembers(noteId: string): Promise<NoteMember[]> {
  const { rows } = await query<{ user_id: string; public_id: string; name: string | null }>(
    `SELECT u.id AS user_id, u.public_id, u.name
       FROM note_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.note_id = $1
      ORDER BY u.public_id ASC`,
    [noteId],
  );
  return rows.map((row) => ({
    userId: row.user_id,
    publicId: row.public_id,
    name: row.name ?? `User ${row.public_id}`,
  }));
}

/** Only a member of the owning workspace may hand a note to someone else. */
export async function canManageNote(noteId: string, userId: string): Promise<boolean> {
  const { rows } = await query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM notes n
        JOIN workspace_members wm ON wm.workspace_id = n.workspace_id
        WHERE n.id = $2 AND wm.user_id = $1
     ) AS ok`,
    [userId, noteId],
  );
  return rows[0]?.ok === true;
}

export async function addNoteMember(
  noteId: string,
  publicId: string,
): Promise<{ ok: true; member: NoteMember } | { ok: false; error: string }> {
  const { rows } = await query<{ id: string; public_id: string; name: string | null }>(
    "SELECT id, public_id, name FROM users WHERE public_id = $1",
    [publicId],
  );
  const user = rows[0];
  if (!user) return { ok: false, error: "No account has that ID." };

  // Owners already have access through their workspace; adding them is a no-op.
  const { rowCount } = await query(
    `INSERT INTO note_members (note_id, user_id, role)
     VALUES ($1, $2, 'editor')
     ON CONFLICT DO NOTHING`,
    [noteId, user.id],
  );
  if (!rowCount) {
    return { ok: false, error: `${user.public_id} already has access.` };
  }
  return {
    ok: true,
    member: {
      userId: user.id,
      publicId: user.public_id,
      name: user.name ?? `User ${user.public_id}`,
    },
  };
}

export async function removeNoteMember(noteId: string, userId: string): Promise<void> {
  await query("DELETE FROM note_members WHERE note_id = $1 AND user_id = $2", [noteId, userId]);
}
