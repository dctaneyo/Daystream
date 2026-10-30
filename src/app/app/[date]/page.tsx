import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveActiveWorkspace } from "@/lib/workspaces";
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

  const activity = await monthActivity(workspace.id, month);
  const heat = Object.fromEntries(activity.map((entry) => [entry.date, entry.count]));
  const cells = calendarGrid(month);

  return (
    <div className="xl:grid xl:grid-cols-[1fr_312px]">
      <main className="flex min-h-0 flex-col">
        <DailyCanvas
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          room={dayRoom(workspace.id, date)}
          mode="day"
          date={date}
          title={formatLongDate(date)}
          user={{
            id: userId,
            name: session.user.name ?? session.user.email ?? "You",
          }}
        />
      </main>

      <aside className="hidden border-l border-edge bg-panel/40 p-4 xl:block">
        <CalendarPanel
          month={month}
          activeDate={date}
          cells={cells}
          heat={heat}
          workspaceName={workspace.name}
        />
      </aside>
    </div>
  );
}
