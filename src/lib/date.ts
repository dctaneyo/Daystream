const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The app's "today". Set APP_TIMEZONE on Railway (e.g. America/New_York). */
export function todayISO(now: Date = new Date()): string {
  const timeZone = process.env.APP_TIMEZONE || undefined;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);
  }
}

export function isISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toUTCDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** "Friday, October 30, 2026" */
export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(toUTCDate(iso));
}

/** "Oct 30" */
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(toUTCDate(iso));
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(toUTCDate(`${month}-01`));
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function isValidMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}-01T00:00:00Z`).getTime());
}

export type CalendarCell = { date: string; inMonth: boolean; isToday: boolean };

/** A 6x7 calendar grid for the given month, weeks starting Sunday (UTC-based). */
export function calendarGrid(month: string, today: string = todayISO()): CalendarCell[] {
  const first = `${month}-01`;
  const firstDate = toUTCDate(first);
  const startOffset = firstDate.getUTCDay();
  const gridStart = addDays(first, -startOffset);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = addDays(gridStart, i);
    cells.push({ date, inMonth: date.slice(0, 7) === month, isToday: date === today });
  }
  return cells;
}

export function weekdayInitials(): string[] {
  return ["S", "M", "T", "W", "T", "F", "S"];
}
