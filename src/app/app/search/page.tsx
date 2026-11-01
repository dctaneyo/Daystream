import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveActiveWorkspace } from "@/lib/workspaces";
import { recentOpenTasks, searchThings } from "@/lib/activity";
import { formatShortDate } from "@/lib/date";

/** The database's type names are not the interface's words (`UX-14`). */
const TYPE_LABEL: Record<string, string> = {
  text: "Text",
  todo: "Task",
  reminder: "Task",
  toggle: "Text",
};

export const metadata = { title: "Search" };
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const workspace = await resolveActiveWorkspace(userId);
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const [hits, open] = await Promise.all([
    searchThings(workspace.id, term),
    recentOpenTasks(workspace.id, 7),
  ]);

  const grouped = new Map<string, typeof hits>();
  for (const hit of hits) {
    const key = hit.room_date ?? "backlog";
    const list = grouped.get(key) ?? [];
    list.push(hit);
    grouped.set(key, list);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Search</h1>
      <form className="mt-4 flex gap-2" action="/app/search">
        <input
          name="q"
          defaultValue={term}
          placeholder={`Search ${workspace.name}…`}
          className="ds-input"
          autoFocus
        />
        <button type="submit" className="ds-button shrink-0 px-4">
          Go
        </button>
      </form>

      {term.length > 0 && hits.length === 0 && (
        <p className="mt-8 text-sm text-muted">No matches for “{term}”.</p>
      )}

      {[...grouped.entries()].map(([date, items]) => (
        <section key={date} className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
            {date === "backlog" ? (
              <Link href="/app/backlog" className="hover:text-ink">
                Backlog
              </Link>
            ) : (
              <Link href={`/app/${date}`} className="hover:text-ink">
                {formatShortDate(date)}
              </Link>
            )}
          </h2>
          <ul className="mt-2 divide-y divide-edge rounded-xl border border-edge bg-panel">
            {items.map((item) => (
              <li key={item.id} className="px-3.5 py-2.5 text-sm">
                <span className="mr-2 text-[11px] uppercase tracking-wide text-muted">
                  {TYPE_LABEL[item.type] ?? "Text"}
                </span>
                <span className={item.is_completed ? "text-muted line-through" : "text-ink"}>
                  {item.content}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
          Open tasks · last 7 days
        </h2>
        {open.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing open. Suspiciously well organised.</p>
        ) : (
          <ul className="mt-2 divide-y divide-edge rounded-xl border border-edge bg-panel">
            {open.map((item) => (
              <li key={item.id} className="flex items-start gap-2 px-3.5 py-2.5 text-sm">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span className="text-ink">{item.content}</span>
                {item.room_date && (
                  <Link
                    href={`/app/${item.room_date}`}
                    className="ml-auto shrink-0 text-xs text-muted hover:text-ink"
                  >
                    {formatShortDate(item.room_date)}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
