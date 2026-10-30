"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "daystream-theme";

type Theme = "system" | "light" | "dark";

const OPTIONS: Array<{ value: Theme; label: string; icon: string; title: string }> = [
  { value: "system", label: "System", icon: "◐", title: "Follow device setting" },
  { value: "light", label: "Light", icon: "☀", title: "Always light" },
  { value: "dark", label: "Dark", icon: "☾", title: "Always dark" },
];

export function applyTheme(theme: Theme): void {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.dataset.theme = theme;
  root.style.colorScheme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#08090b" : "#fbfbfd");
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") setTheme(stored);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      const current = localStorage.getItem(STORAGE_KEY) ?? "system";
      if (current === "system") applyTheme("system");
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  const choose = useCallback((next: Theme) => {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, []);

  return (
    <div
      role="group"
      aria-label="Theme"
      className={`flex items-center gap-0.5 rounded-lg border border-edge bg-panel p-0.5 ${
        compact ? "" : "w-full"
      }`}
    >
      {OPTIONS.map((option) => {
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            data-theme-option={option.value}
            title={option.title}
            aria-pressed={active}
            onClick={() => choose(option.value)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-[6px] px-2 py-1 text-[11px] transition ${
              active ? "bg-raised text-ink" : "text-muted hover:text-ink"
            }`}
          >
            <span aria-hidden>{option.icon}</span>
            {!compact && <span>{option.label}</span>}
            <span className="sr-only">{option.label} theme</span>
          </button>
        );
      })}
    </div>
  );
}
