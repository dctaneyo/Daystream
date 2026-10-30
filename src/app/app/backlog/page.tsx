import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveActiveWorkspace } from "@/lib/workspaces";
import { backlogRoom } from "@/lib/rooms";
import { DailyCanvas } from "@/components/DailyCanvas";

export const metadata = { title: "Backlog" };

export default async function BacklogPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const workspace = await resolveActiveWorkspace(userId);

  return (
    <main className="flex min-h-0 flex-col">
      <DailyCanvas
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        room={backlogRoom(workspace.id)}
        mode="backlog"
        date={null}
        title="Backlog"
        user={{
          id: userId,
          name: session.user.name ?? session.user.email ?? "You",
        }}
      />
    </main>
  );
}
