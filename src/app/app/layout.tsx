import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signOutAction } from "@/actions/auth";
import { switchWorkspaceAction } from "@/actions/workspaces";
import { listWorkspaces, resolveActiveWorkspace } from "@/lib/workspaces";
import { todayISO } from "@/lib/date";
import { Brand } from "@/components/Brand";
import { NavLinks } from "@/components/NavLinks";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const workspace = await resolveActiveWorkspace(userId);
  const workspaces = await listWorkspaces(userId);
  const today = todayISO();

  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:h-dvh lg:min-h-0 lg:grid-cols-[236px_1fr] lg:overflow-hidden">
      <aside className="hidden border-r border-edge bg-panel/60 lg:flex lg:min-h-0 lg:flex-col lg:gap-6 lg:overflow-y-auto lg:p-5">
        <Link href={`/app/${today}`} className="flex items-center gap-2.5 px-1 py-1">
          <Brand />
        </Link>

        <div>
          <p className="px-1 text-[11px] font-medium uppercase tracking-wider text-muted">
            Workspaces
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {workspaces.map((item) => {
              const active = item.id === workspace.id;
              return (
                <li key={item.id}>
                  <form action={switchWorkspaceAction}>
                    <input type="hidden" name="workspaceId" value={item.id} />
                    <button
                      type="submit"
                      aria-current={active ? "true" : undefined}
                      className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                        active
                          ? "bg-raised text-ink"
                          : "text-muted hover:bg-raised/60 hover:text-ink"
                      }`}
                    >
                      {item.name}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          <Link
            href="/app/settings"
            className="mt-2 block px-3 py-2 text-xs text-muted hover:text-ink"
          >
            + New workspace
          </Link>
        </div>

        <div className="border-t border-edge pt-4">
          <NavLinks today={today} layout="sidebar" />
        </div>

        <div className="mt-auto border-t border-edge pt-4">
          <p className="truncate px-1 text-sm text-ink">{session?.user?.name}</p>
          <p className="truncate px-1 font-mono text-xs text-muted">ID {session?.user?.publicId}</p>
          {session?.user?.isAdmin ? (
            <Link
              href="/admin"
              className="mt-3 block rounded-lg border border-edge px-3 py-1.5 text-center text-xs text-muted transition hover:border-accent/40 hover:text-ink"
            >
              Admin console
            </Link>
          ) : null}
          <div className="mt-3">
            <ThemeToggle compact />
          </div>
          <form action={signOutAction} className="mt-3 px-1">
            <button type="submit" className="text-xs text-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-edge bg-canvas/85 px-4 py-3 backdrop-blur lg:hidden">
          <Link href={`/app/${today}`} className="flex items-center gap-2">
            <Brand compact />
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/app/search" className="text-muted hover:text-ink">
              Search
            </Link>
            <Link href="/app/backlog" className="text-muted hover:text-ink">
              Backlog
            </Link>
          </nav>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
