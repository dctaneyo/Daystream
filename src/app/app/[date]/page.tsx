import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveActiveWorkspace } from "@/lib/workspaces";
import { createNoteForDayAction } from "@/actions/notes";
import { listNotesForDay } from "@/lib/notes";
import { monthActivity } from "@/lib/activity";
import { addDays, calendarGrid, formatLongDate, isISODate, monthKey, todayISO } from "@/lib/date";
import { CalendarPanel } from "@/components/CalendarPanel";

export default async function DayPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { date } = await params;
  if (!isISODate(date)) notFound();

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const workspace = await resolveActiveWorkspace(userId);
  const { m } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : monthKey(date);

  const [notes, activity] = await Promise.all([
    listNotesForDay(userId, date),
    monthActivity(workspace.id, month),
  ]);
  const heat = Object.fromEntries(activity.map((entry) => [entry.date, entry.count]));
  const cells = calendarGrid(month);
  const today = todayISO();

  return (
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      <main className="ds-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
        <header className="border-b border-edge px-4 pb-4 pt-5 sm:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{date}</p>
            <nav className="flex items-center gap-1 text-xs text-muted">
              <Link
                href={`/app/${addDays(date, -1)}`}
                aria-label="Previous day"
                className="grid h-11 w-11 place-items-center rounded-md hover:bg-raised hover:text-ink"
              >
                ‹
              </Link>
              <Link href={`/app/${today}`} className="grid h-11 place-items-center rounded-md px-2 hover:bg-raised hover:text-ink">
                Today
              </Link>
              <Link
                href={`/app/${addDays(date, 1)}`}
                aria-label="Next day"
                className="grid h-11 w-11 place-items-center rounded-md hover:bg-raised hover:text-ink"
              >
                ›
              </Link>
            </nav>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{formatLongDate(date)}</h1>
          <p className="mt-1 text-sm text-muted">
            {notes.length === 0
              ? "No Notes on this day yet."
              : `${notes.length} ${notes.length === 1 ? "Note" : "Notes"} on this day.`}
          </p>
        </header>

        <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6">
          <ul data-day-notes="true" className="flex flex-col gap-2">
            {notes.map((note) => (
              <li key={note.id}>
                <Link
                  href={`/app/notes/${note.id}`}
                  className="flex min-h-16 items-center gap-3 rounded-xl border border-edge bg-panel px-4 py-3 transition hover:bg-raised/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-ink">{note.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted">
                      {note.thingCount} {note.thingCount === 1 ? "Thing" : "Things"}
                      {note.sharedWithMe ? " · shared with you" : ""}
                      {note.memberCount > 0 && !note.sharedWithMe ? " · shared" : ""}
                    </span>
                  </span>
                  {note.isInbox && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">Inbox</span>
                  )}
                  <span aria-hidden className="shrink-0 text-muted">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {notes.length === 0 && (
            <p className="mt-2 rounded-xl border border-dashed border-edge px-4 py-6 text-center text-sm text-muted">
              A Note is the home for the Things you write. Name one below and it opens, ready for typing.
            </p>
          )}

          <form action={createNoteForDayAction} className="mt-5 flex gap-2">
            <input type="hidden" name="day" value={date} />
            <input
              name="title"
              required
              maxLength={120}
              placeholder="New Note for this day"
              aria-label="New Note"
              className="ds-input"
            />
            <button
              type="submit"
              className="ds-button ds-button-primary min-h-11 shrink-0 px-4 text-xs"
            >
              Create
            </button>
          </form>
        </div>
      </main>

      <aside className="hidden min-h-0 w-[312px] shrink-0 overflow-y-auto border-l border-edge bg-panel/40 p-4 xl:block">
        <CalendarPanel
          month={month}
          activeDate={date}
          cells={cells}
          heat={heat}
          workspaceName={workspace.name}
          workspaceId={workspace.id}
          userId={userId}
        />
      </aside>
    </div>
  );
}
