import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listWorkspaces } from "@/lib/workspaces";
import { createWorkspaceAction } from "@/actions/workspaces";
import { ChangePinForm } from "@/components/ChangePinForm";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { buildId } from "@/lib/build-id";

export const metadata = { title: "Settings" };
export default async function SettingsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const workspaces = await listWorkspaces(userId);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      <section className="mt-6 rounded-xl border border-edge bg-panel p-4">
        <h2 className="text-sm font-medium">Account</h2>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-edge bg-raised px-3.5 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Daystream ID</p>
            <p className="font-mono text-xl tracking-[0.25em]">{session?.user?.publicId}</p>
          </div>
          <p className="max-w-[50%] text-right text-xs text-muted">
            Sign in with this ID plus your 6-digit PIN on any device.
          </p>
        </div>
        <p className="mt-3 text-sm text-muted">{session?.user?.name}</p>
        {session?.user?.email ? <p className="text-sm text-muted">{session.user.email}</p> : null}
        {session?.user?.isAdmin ? (
          <Link href="/admin" className="mt-3 inline-block text-xs text-accent hover:underline">
            Open admin console →
          </Link>
        ) : null}
      </section>

      <section className="mt-4 rounded-xl border border-edge bg-panel p-4">
        <h2 className="text-sm font-medium">Appearance</h2>
        <p className="mt-1 text-xs text-muted">
          Follows your device by default. Pick light or dark to override it on this device.
        </p>
        <div className="mt-3 max-w-xs">
          <ThemeToggle />
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-edge bg-panel p-4">
        <h2 className="text-sm font-medium">Change PIN</h2>
        <p className="mt-1 text-xs text-muted">
          Six digits. Changing it signs out nothing — your current session stays valid.
        </p>
        <ChangePinForm />
      </section>

      <section className="mt-4 rounded-xl border border-edge bg-panel p-4">
        <h2 className="text-sm font-medium">Workspaces</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
          {workspaces.map((workspace) => (
            <li key={workspace.id} className="flex items-center justify-between">
              <span className="text-ink">{workspace.name}</span>
              <span className="text-xs uppercase tracking-wide">{workspace.role}</span>
            </li>
          ))}
        </ul>
        <form action={createWorkspaceAction} className="mt-4 flex gap-2">
          <input
            name="name"
            placeholder="New workspace name"
            required
            maxLength={40}
            className="ds-input"
          />
          <button type="submit" className="ds-button shrink-0 px-4">
            Add
          </button>
        </form>
      </section>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Inviting teammates and calendar integration land next. Until then an admin can create
        accounts from the admin console.
      </p>

      <p className="mt-3 font-mono text-[11px] text-muted">Build {buildId()}</p>
    </div>
  );
}
