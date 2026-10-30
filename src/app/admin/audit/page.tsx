import { listAuditLog } from "@/lib/users";

export const metadata = { title: "Admin · Audit log" };

const LABELS: Record<string, string> = {
  "user.create": "Created account",
  "user.suspend": "Suspended account",
  "user.activate": "Activated account",
  "user.grant_admin": "Granted admin access",
  "user.revoke_admin": "Revoked admin access",
  "user.reset_pin": "Reset PIN",
  "user.delete": "Deleted account",
  "workspace.delete": "Deleted workspace",
};

export default async function AdminAuditPage() {
  const entries = await listAuditLog(150);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted">Every administrative action, newest first.</p>
      </header>

      {entries.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-edge px-3.5 py-6 text-sm text-muted">
          Nothing logged yet.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-edge rounded-xl border border-edge bg-panel">
          {entries.map((entry) => (
            <li key={entry.id} className="px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="text-ink">{LABELS[entry.action] ?? entry.action}</span>
                {entry.targetPublicId && (
                  <span className="font-mono text-xs text-muted">ID {entry.targetPublicId}</span>
                )}
                <span className="ml-auto text-xs text-muted">
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(entry.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted">
                by {entry.actorName ?? "unknown"} {entry.actorPublicId ? `(ID ${entry.actorPublicId})` : ""}
                {Object.keys(entry.details).length > 0 && (
                  <span className="ml-2 font-mono">{JSON.stringify(entry.details)}</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
