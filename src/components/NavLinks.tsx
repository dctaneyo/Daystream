"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * There is one view (a day) and one utility (settings). Search is a control on
 * that view — a sheet, not a destination — so it dispatches rather than
 * navigates (UX-23, UI-11).
 */
export function NavLinks({ layout }: { today?: string; layout: "sidebar" | "mobile" }) {
  const pathname = usePathname() ?? "";
  const onDay = pathname === "/app";

  const rows = [
    {
      key: "day",
      label: "Today",
      href: "/app",
      active: onDay,
      onClick: undefined as (() => void) | undefined,
    },
    {
      key: "search",
      label: "Search",
      href: null,
      active: false,
      onClick: () => window.dispatchEvent(new CustomEvent("daystream:search")),
    },
    {
      key: "settings",
      label: "Settings",
      href: "/app/settings",
      active: pathname.startsWith("/app/settings"),
      onClick: undefined,
    },
  ];

  if (layout === "mobile") {
    return (
      <ul className="grid grid-cols-3">
        {rows.map((row) => (
          <li key={row.key}>
            {row.href ? (
              <Link
                href={row.href}
                aria-current={row.active ? "page" : undefined}
                className={`flex min-h-[3.5rem] items-center justify-center text-[11px] ${
                  row.active ? "font-medium text-accent" : "text-muted"
                }`}
              >
                {row.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={row.onClick}
                className="flex min-h-[3.5rem] w-full items-center justify-center text-[11px] text-muted"
              >
                {row.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => (
        <li key={row.key}>
          {row.href ? (
            <Link
              href={row.href}
              aria-current={row.active ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                row.active ? "bg-raised text-ink" : "text-muted hover:bg-raised/60 hover:text-ink"
              }`}
            >
              {row.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={row.onClick}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition hover:bg-raised/60 hover:text-ink"
            >
              {row.label}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
