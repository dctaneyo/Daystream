"use client";

import { useEffect, useState } from "react";
import { Sheet } from "./Sheet";
import {
  calendarGrid,
  formatLongDate,
  monthKey,
  monthLabel,
  shiftMonth,
  todayISO,
  weekdayInitials,
} from "@/lib/date";

/**
 * Choosing a day is a sheet, not a page and not a run of ‹ taps. The month
 * carries how much was written on each day, so the shape of a month is legible
 * before anything is opened (UX-23, UX-36).
 */
export function MonthSheet({
  open,
  day,
  onClose,
  onPick,
}: {
  open: boolean;
  day: string;
  onClose: () => void;
  onPick: (day: string) => void;
}) {
  const [month, setMonth] = useState(() => monthKey(day));
  const [heat, setHeat] = useState<Record<string, number>>({});

  // Opening the sheet on another day should show that day's month, not a stale one.
  useEffect(() => {
    if (open) setMonth(monthKey(day));
  }, [day, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/activity?m=${month}`);
        if (!response.ok) throw new Error();
        const body = (await response.json()) as { heat?: Record<string, number> };
        if (!cancelled) setHeat(body.heat ?? {});
      } catch {
        // A month without numbers is still a usable calendar.
        if (!cancelled) setHeat({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month, open]);

  const today = todayISO();
  const cells = calendarGrid(month, today);
  const peak = Math.max(1, ...Object.values(heat));

  const intensity = (count: number) => {
    if (count === 0) return "bg-edge/60";
    const ratio = count / peak;
    if (ratio > 0.66) return "bg-accent";
    if (ratio > 0.33) return "bg-accent/65";
    return "bg-accent/35";
  };

  return (
    <Sheet open={open} title="Choose a day" onClose={onClose}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{monthLabel(month)}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonth((current) => shiftMonth(current, -1))}
            aria-label="Previous month"
            className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setMonth((current) => shiftMonth(current, 1))}
            aria-label="Next month"
            className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted">
        {weekdayInitials().map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const count = heat[cell.date] ?? 0;
          const active = cell.date === day;
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onPick(cell.date)}
              aria-current={active ? "date" : undefined}
              aria-label={`${formatLongDate(cell.date)}${count ? `, ${count} ${count === 1 ? "Thing" : "Things"}` : ", nothing written"}`}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition ${
                active
                  ? "bg-accent font-semibold text-accent-ink"
                  : cell.inMonth
                    ? "text-ink hover:bg-raised"
                    : "text-muted/40 hover:bg-raised/50"
              } ${cell.isToday && !active ? "ring-1 ring-inset ring-accent/60" : ""}`}
            >
              <span>{Number(cell.date.slice(-2))}</span>
              {count > 0 && (
                <span
                  aria-hidden
                  className={`mt-0.5 h-1 w-1 rounded-full ${active ? "bg-black/70" : intensity(count)}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-edge pt-3">
        <button
          type="button"
          onClick={() => onPick(today)}
          className="min-h-10 rounded-lg px-2 text-xs text-muted hover:bg-raised hover:text-ink"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 rounded-lg px-2 text-xs text-muted hover:bg-raised hover:text-ink"
        >
          Close
        </button>
      </div>
    </Sheet>
  );
}
