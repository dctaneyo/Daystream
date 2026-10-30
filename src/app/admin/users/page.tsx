import { auth } from "@/auth";
import { listUsersForAdmin } from "@/lib/users";
import { AdminUserRow } from "@/components/admin/AdminUserRow";
import { CreateUserForm } from "@/components/admin/CreateUserForm";

export const metadata = { title: "Admin · Users" };
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const users = await listUsersForAdmin(term);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Users</h1>
        </div>
        <form action="/admin/users" className="flex gap-2">
          <input
            name="q"
            defaultValue={term}
            placeholder="ID, name or email"
            className="ds-input w-52"
            aria-label="Search users"
          />
          <button type="submit" className="ds-button px-4">
            Search
          </button>
        </form>
      </header>

      <div className="mt-6">
        <CreateUserForm />
      </div>

      <section className="mt-6">
        <p className="text-xs text-muted">
          {users.length} {users.length === 1 ? "account" : "accounts"}
          {term ? ` matching “${term}”` : ""}
        </p>
        <div className="mt-2 overflow-hidden rounded-xl border border-edge bg-panel">
          {users.length === 0 ? (
            <p className="px-3.5 py-6 text-sm text-muted">No accounts match.</p>
          ) : (
            users.map((user) => (
              <AdminUserRow
                key={user.id}
                user={{
                  id: user.id,
                  publicId: user.publicId,
                  name: user.name,
                  email: user.email,
                  isAdmin: user.isAdmin,
                  status: user.status,
                  createdAt: user.createdAt.toISOString(),
                  lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
                  workspaceCount: user.workspaceCount,
                  thingCount: user.thingCount,
                  isSelf: user.id === session?.user?.id,
                }}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
