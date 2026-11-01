import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveActiveWorkspace } from "@/lib/workspaces";
import { listNoteChoices } from "@/lib/notes";
import { monthActivity } from "@/lib/activity";
import { calendarGrid, formatLongDate, isISODate, monthKey } from "@/lib/date";
import { dayRoom } from "@/lib/rooms";
import { DailyCanvas } from "@/components/DailyCanvas";
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

  const [activity, notes] = await Promise.all([
    monthActivity(workspace.id, month),
    listNoteChoices(userId),
  ]);
  const heat = Object.fromEntries(activity.map((entry) => [entry.date, entry.count]));
  const cells = calendarGrid(month);

  return (
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      <main className="flex min-h-0 flex-1 flex-col">
        <DailyCanvas
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          room={dayRoom(workspace.id, date)}
          mode="day"
          date={date}
          title={formatLongDate(date)}
          notes={notes}
          user={{
            id: userId,
            name: session.user.name ?? session.user.email ?? "You",
          }}
        />
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
