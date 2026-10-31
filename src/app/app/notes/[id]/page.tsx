import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getNoteForUser, listNoteMembers } from "@/lib/notes";
import { noteRoom } from "@/lib/rooms";
import { DailyCanvas } from "@/components/DailyCanvas";
import { NoteSharePanel } from "@/components/NoteSharePanel";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const note = await getNoteForUser(id, userId);
  if (!note) notFound();

  const members = await listNoteMembers(note.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      <main className="flex min-h-0 flex-1 flex-col">
        <DailyCanvas
          workspaceId={note.workspaceId}
          workspaceName={note.sharedWithMe ? "Shared note" : note.workspaceName}
          room={noteRoom(note.id)}
          mode="note"
          date={null}
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
        />
      </aside>
    </div>
  );
}
