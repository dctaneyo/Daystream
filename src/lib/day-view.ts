import { query } from "@/lib/db";
import { listNoteMembers, listNotesForDay, type NoteMember } from "@/lib/notes";

/** Everything the one view needs for a day, and nothing more. */
export type DayNote = {
  id: string;
  title: string;
  thingCount: number;
  memberCount: number;
  isInbox: boolean;
  canManage: boolean;
  sharedWithMe: boolean;
  members: NoteMember[];
};

export type DayView = {
  notes: DayNote[];
  inboxId: string | null;
};

export async function loadDayView(userId: string, day: string): Promise<DayView> {
  const notes = await listNotesForDay(userId, day);

  const detailed = await Promise.all(
    notes.map(async (note): Promise<DayNote> => {
      const members = note.memberCount > 0 ? await listNoteMembers(note.id) : [];
      return {
        id: note.id,
        title: note.title,
        thingCount: note.thingCount,
        memberCount: note.memberCount,
        isInbox: note.isInbox,
        canManage: note.canManage,
        sharedWithMe: note.sharedWithMe,
        members,
      };
    }),
  );

  const { rows } = await query<{ id: string }>(
    `SELECT n.id
       FROM notes n
      WHERE n.is_inbox
        AND EXISTS (SELECT 1 FROM workspace_members wm
                     WHERE wm.workspace_id = n.workspace_id AND wm.user_id = $1)
      LIMIT 1`,
    [userId],
  );

  return { notes: detailed, inboxId: rows[0]?.id ?? null };
}
