import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signOutAction } from "@/actions/auth";
import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect("/login");
  if (!user.isAdmin) redirect("/app");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[228px_1fr]">
      <aside className="hidden border-r border-edge bg-panel/60 lg:flex lg:flex-col lg:gap-6 lg:p-5">
        <div>
          <Brand />
          <p className="mt-2 px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Admin console
          </p>
        </div>

        <nav aria-label="Admin sections">
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-raised/60 hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-edge pt-4">
          <Link
            href="/app"
            className="rounded-lg bg-raised px-3 py-2 text-sm text-ink transition hover:bg-hover"
          >
            ← Open Daystream
          </Link>
          <div>
            <p className="truncate px-1 text-sm text-ink">{user.name}</p>
            <p className="px-1 font-mono text-xs text-muted">ID {user.publicId}</p>
          </div>
          <ThemeToggle compact />
          <form action={signOutAction} className="px-1">
            <button type="submit" className="text-xs text-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-edge bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/admin" className="flex items-center gap-2">
            <Brand compact />
          </Link>
          <nav className="flex items-center gap-3 text-xs">
            <Link href="/admin/users" className="text-muted hover:text-ink">
              Users
            </Link>
            <Link href="/admin/workspaces" className="text-muted hover:text-ink">
              Spaces
            </Link>
            <Link href="/app" className="text-ink">
              App →
            </Link>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
