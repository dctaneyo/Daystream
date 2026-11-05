export const DAY_MS = 86_400_000;

const pad = (value: number) => String(value).padStart(2, "0");

export function toKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export const todayKey = () => toKey(new Date());

export function addDays(key: string, amount: number): string {
  const date = fromKey(key);
  date.setDate(date.getDate() + amount);
  return toKey(date);
}

export function weekdayShort(key: string): string {
  return fromKey(key).toLocaleDateString("en-US", { weekday: "short" });
}

export function weekdayLong(key: string): string {
  return fromKey(key).toLocaleDateString("en-US", { weekday: "long" });
}

export function dayNumber(key: string): string {
  return String(fromKey(key).getDate());
}

export function longDate(key: string): string {
  const date = fromKey(key);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export const isToday = (key: string) => key === todayKey();

export function relativeDay(key: string): string {
  const today = todayKey();
  if (key === today) return "Today";
  if (key === addDays(today, 1)) return "Tomorrow";
  if (key === addDays(today, -1)) return "Yesterday";
  return weekdayLong(key);
}

export function readDateParam(search: string): string | null {
  const value = new URLSearchParams(search).get("d");
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
