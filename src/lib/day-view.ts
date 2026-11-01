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

  return { notes: detailed };
}
