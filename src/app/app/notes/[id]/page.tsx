import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  countThingsInNote,
  getNoteForUser,
  listNoteChoices,
  listNoteMembers,
} from "@/lib/notes";
import { noteRoom } from "@/lib/rooms";
import { DailyCanvas } from "@/components/DailyCanvas";
import { NoteSharePanel } from "@/components/NoteSharePanel";

export default async function NotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ add?: string; task?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const note = await getNoteForUser(id, userId);
  if (!note) notFound();

  const [members, thingCount, choices] = await Promise.all([
    listNoteMembers(note.id),
    countThingsInNote(note.id),
    listNoteChoices(userId),
  ]);
  // Filing a Thing into the Note it already lives in is not a move.
  const notes = choices.filter((choice) => choice.id !== note.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      <main className="flex min-h-0 flex-1 flex-col">
        <DailyCanvas
          workspaceId={note.workspaceId}
          workspaceName={note.sharedWithMe ? "Shared note" : note.workspaceName}
          room={noteRoom(note.id)}
          mode="note"
          date={null}
          notes={notes}
          pendingDraft={query.add}
          pendingTask={query.task === "1"}
          title={note.title}
          user={{
            id: userId,
            name: session.user.name ?? session.user.email ?? "You",
          }}
        />
      </main>

      <aside className="min-h-0 w-full shrink-0 overflow-y-auto border-t border-edge bg-panel/40 p-4 xl:w-[312px] xl:border-l xl:border-t-0">
        <NoteSharePanel
          noteId={note.id}
          title={note.title}
          members={members}
          canManage={note.canManage}
          sharedWithMe={note.sharedWithMe}
          thingCount={thingCount}
        />
      </aside>
    </div>
  );
}
