import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listNotes } from "@/lib/notes";
import { NoteComposer } from "@/components/NoteComposer";

export const metadata = { title: "Notes" };

function updatedLabel(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default async function NotesPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const notes = await listNotes(userId);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Notes</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="mt-1 text-sm text-muted">
          A note holds any number of Things — one per topic or idea. Share a note and you edit it
          together, live.
        </p>
      </header>

      <div className="mt-5">
        <NoteComposer />
      </div>

      <ul className="mt-6 divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-panel">
        {notes.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted">No notes yet. Create the first one above.</li>
        ) : (
          notes.map((note) => (
            <li key={note.id}>
              <Link
                href={`/app/notes/${note.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-raised/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{note.title}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {note.sharedWithMe ? "shared with you" : note.workspaceName} ·{" "}
                    {note.memberCount === 0
                      ? "just you"
                      : `${note.memberCount} ${note.memberCount === 1 ? "person" : "people"}`}{" "}
                    · updated {updatedLabel(note.updatedAt)}
                  </span>
                </span>
                {note.memberCount > 0 && (
                  <span className="shrink-0 rounded-full border border-accent/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent">
                    shared
                  </span>
                )}
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
