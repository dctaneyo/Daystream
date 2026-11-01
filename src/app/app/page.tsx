import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveActiveWorkspace } from "@/lib/workspaces";
import { loadDayView } from "@/lib/day-view";
import { isISODate, todayISO } from "@/lib/date";
import { DayHome } from "@/components/DayHome";

/**
 * The app is one view (UX-23). A day can be deep-linked with `?d=`, and the kept
 * extras — search, the backlog, the scratchpad — are sheets inside it, so no
 * navigation ever replaces the page you were writing on.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; sheet?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const params = await searchParams;
  const today = todayISO();
  const day = params.d && isISODate(params.d) ? params.d : today;

  const [workspace, view] = await Promise.all([
    resolveActiveWorkspace(userId),
    loadDayView(userId, day),
  ]);

  return (
    <DayHome
      initialDay={day}
      initialNotes={view.notes}
      initialInboxId={view.inboxId}
      initialSheet={params.sheet === "inbox" ? "inbox" : null}
      workspaceId={workspace.id}
      user={{
        id: userId,
        name: session?.user?.name ?? session?.user?.email ?? "You",
      }}
    />
  );
}
