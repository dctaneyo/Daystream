import Link from "next/link";
import { getAdminStats, listAuditLog, listUsersForAdmin } from "@/lib/users";

export const metadata = { title: "Admin overview" };

function when(value: Date | null): string {
  if (!value) return "never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default async function AdminOverviewPage() {
  const [stats, users, audit] = await Promise.all([
    getAdminStats(),
    listUsersForAdmin("", 6),
    listAuditLog(8),
  ]);

  const cards = [
    { label: "Accounts", value: stats.users, hint: `${stats.activeUsers} active` },
    { label: "Admins", value: stats.admins, hint: `${stats.suspended} suspended` },
    { label: "Workspaces", value: stats.workspaces, hint: `${stats.documents} live docs` },
    { label: "Things", value: stats.things, hint: `${stats.thingsToday} added today` },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Overview</h1>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-edge bg-panel p-4">
            <dt className="text-xs text-muted">{card.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</dd>
            <p className="mt-0.5 text-[11px] text-muted">{card.hint}</p>
          </div>
        ))}
      </dl>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Newest accounts</h2>
          <Link href="/admin/users" className="text-xs text-muted hover:text-ink">
            Manage users →
          </Link>
        </div>
        <div className="mt-2 overflow-hidden rounded-xl border border-edge bg-panel">
          <table className="w-full text-sm">
            <thead className="bg-raised/60 text-left text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-edge">
                  <td className="px-3 py-2 font-mono text-xs">{user.publicId}</td>
                  <td className="px-3 py-2">
                    {user.name}
                    {user.isAdmin && (
                      <span className="ml-2 rounded-full border border-accent/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent">
                        admin
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted">{when(user.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Recent admin activity</h2>
          <Link href="/admin/audit" className="text-xs text-muted hover:text-ink">
            Full log →
          </Link>
        </div>
        {audit.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-edge px-3.5 py-4 text-sm text-muted">
            No admin actions yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-edge rounded-xl border border-edge bg-panel">
            {audit.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                <span className="font-mono text-xs text-muted">{entry.action}</span>
                <span className="truncate text-muted">
                  {entry.targetPublicId ? `ID ${entry.targetPublicId}` : entry.actorPublicId ?? "—"}
                </span>
                <span className="shrink-0 text-xs text-muted">{when(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
