"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app/__today__", label: "Daily feed", matcher: (path: string) => /^\/app\/\d{4}-\d{2}-\d{2}$/.test(path) },
  { href: "/app/backlog", label: "Backlog", matcher: (path: string) => path === "/app/backlog" },
  { href: "/app/search", label: "Search", matcher: (path: string) => path.startsWith("/app/search") },
  { href: "/app/settings", label: "Settings", matcher: (path: string) => path.startsWith("/app/settings") },
];

export function NavLinks({ today, layout }: { today: string; layout: "sidebar" | "mobile" }) {
  const pathname = usePathname() ?? "";

  return (
    <ul className={layout === "sidebar" ? "flex flex-col gap-1" : "flex items-center gap-3"}>
      {items.map((item) => {
        const href = item.href.replace("__today__", today);
        const active = item.matcher(pathname);
        return (
          <li key={item.label}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                layout === "sidebar"
                  ? `block rounded-lg px-3 py-2 text-sm transition ${
                      active ? "bg-raised text-ink" : "text-muted hover:bg-raised/60 hover:text-ink"
                    }`
                  : active
                    ? "text-ink"
                    : "text-muted hover:text-ink"
              }
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
