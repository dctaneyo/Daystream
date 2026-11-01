import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { resolveActiveWorkspace } from "@/lib/workspaces";
import { countThingsInNote, listNoteMembers } from "@/lib/notes";
import type { DayNote } from "@/lib/day-view";

/**
 * The backlog sheet must never depend on an id that may not exist. This resolves
 * the workspace's Inbox and creates it if an older workspace predates it, so the
 * sheet always has something to open (UX-09, UX-10).
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const workspace = await resolveActiveWorkspace(userId);

  const find = async () =>
    (
      await query<{ id: string; title: string }>(
        `SELECT id, title FROM notes
          WHERE workspace_id = $1 AND is_inbox
          ORDER BY created_at ASC
          LIMIT 1`,
        [workspace.id],
      )
    ).rows[0];

  let inbox = await find();
  if (!inbox) {
    inbox = (
      await query<{ id: string; title: string }>(
        `INSERT INTO notes (workspace_id, title, created_by, is_inbox)
         VALUES ($1, 'Inbox', $2, true)
         RETURNING id, title`,
        [workspace.id, userId],
      )
    ).rows[0];
  }
  if (!inbox) {
    return NextResponse.json({ error: "No Inbox for this workspace." }, { status: 404 });
  }

  const [members, thingCount] = await Promise.all([
    listNoteMembers(inbox.id),
    countThingsInNote(inbox.id),
  ]);

  const body: DayNote = {
    id: inbox.id,
    title: inbox.title,
    thingCount,
    memberCount: members.length,
    isInbox: true,
    canManage: true,
    sharedWithMe: false,
    members,
  };

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
