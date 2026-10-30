import { listWorkspacesForAdmin } from "@/lib/users";
import { deleteWorkspaceAction } from "@/actions/admin";

export const metadata = { title: "Admin · Workspaces" };

export default async function AdminWorkspacesPage() {
  const workspaces = await listWorkspacesForAdmin();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Workspaces</h1>
        <p className="mt-1 text-sm text-muted">
          {workspaces.length} total. Deleting a workspace removes its notes and synced documents.
        </p>
      </header>

      <div className="mt-6 overflow-hidden rounded-xl border border-edge bg-panel">
        {workspaces.length === 0 ? (
          <p className="px-3.5 py-6 text-sm text-muted">No workspaces yet.</p>
        ) : (
          workspaces.map((workspace) => (
            <div key={workspace.id} className="border-t border-edge px-3.5 py-3 first:border-t-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm text-ink">{workspace.name}</span>
                <span className="text-[11px] text-muted">
                  owner {workspace.ownerPublicId ?? "—"} {workspace.ownerName ? `(${workspace.ownerName})` : ""}
                </span>
                <span className="ml-auto text-[11px] text-muted">
                  {workspace.memberCount} members · {workspace.thingCount} things ·{" "}
                  {workspace.documentCount} docs
                </span>
                <form action={deleteWorkspaceAction}>
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="name" value={workspace.name} />
                  <button
                    type="submit"
                    className="rounded-md px-2.5 py-1 text-xs text-red-600 hover:bg-red-500/10 dark:text-red-300"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
