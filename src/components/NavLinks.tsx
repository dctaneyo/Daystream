"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/app/__today__",
    label: "Daily feed",
    short: "Today",
    matcher: (path: string) => /^\/app\/\d{4}-\d{2}-\d{2}$/.test(path),
  },
  {
    href: "/app/backlog",
    label: "Backlog",
    short: "Backlog",
    matcher: (path: string) => path === "/app/backlog",
  },
  {
    href: "/app/notes",
    label: "Notes",
    short: "Notes",
    matcher: (path: string) => path.startsWith("/app/notes"),
  },
  {
    href: "/app/search",
    label: "Search",
    short: "Search",
    matcher: (path: string) => path.startsWith("/app/search"),
  },
  {
    href: "/app/settings",
    label: "Settings",
    short: "Settings",
    matcher: (path: string) => path.startsWith("/app/settings"),
  },
];

/**
 * One definition, two shapes: a sidebar on wide screens and the phone's primary
 * bar. Keeping them in one list is what stops a destination from existing on
 * desktop and vanishing on mobile (UI-11).
 */
export function NavLinks({ today, layout }: { today: string; layout: "sidebar" | "mobile" }) {
  const pathname = usePathname() ?? "";

  if (layout === "mobile") {
    return (
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = item.matcher(pathname);
          return (
            <li key={item.label}>
              <Link
                href={item.href.replace("__today__", today)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[3.5rem] flex-col items-center justify-center px-1 text-[11px] leading-tight ${
                  active ? "font-medium text-accent" : "text-muted"
                }`}
              >
                {item.short}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.matcher(pathname);
        return (
          <li key={item.label}>
            <Link
              href={item.href.replace("__today__", today)}
              aria-current={active ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                active ? "bg-raised text-ink" : "text-muted hover:bg-raised/60 hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
