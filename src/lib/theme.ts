import { useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";
export type Accent = "sage" | "slate" | "clay" | "oxblood" | "mono";

export const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export const ACCENTS: { id: Accent; label: string; light: string; dark: string }[] = [
  { id: "sage", label: "Sage", light: "#4A5D4E", dark: "#7A8F7F" },
  { id: "slate", label: "Slate", light: "#4A5568", dark: "#A0AEC0" },
  { id: "clay", label: "Clay", light: "#8C6239", dark: "#D69E2E" },
  { id: "oxblood", label: "Oxblood", light: "#742A2A", dark: "#FEB2B2" },
  { id: "mono", label: "Monochrome", light: "#1A1A18", dark: "#E4E4E1" },
];

const THEME_KEY = "daystream.theme";
const ACCENT_KEY = "daystream.accent";

export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    /* ignore */
  }
  return "system";
}

export function readAccent(): Accent {
  try {
    const value = localStorage.getItem(ACCENT_KEY);
    if (ACCENTS.some((accent) => accent.id === value)) return value as Accent;
  } catch {
    /* ignore */
  }
  return "sage";
}

export function applyAppearance(theme: Theme, accent: Accent): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.accent = accent;
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.style.colorScheme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#121211" : "#F9F8F6");
}

export function useAppearance() {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const [accent, setAccentState] = useState<Accent>(readAccent);
  const [dark, setDark] = useState(
    () =>
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches),
  );

  useEffect(() => {
    applyAppearance(theme, accent);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const isDark = theme === "dark" || (theme === "system" && media.matches);
      setDark(isDark);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [theme, accent]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const setAccent = (next: Accent) => {
    setAccentState(next);
    try {
      localStorage.setItem(ACCENT_KEY, next);
    } catch {
      /* ignore */
    }
  };

  return { theme, accent, dark, setTheme, setAccent };
}
