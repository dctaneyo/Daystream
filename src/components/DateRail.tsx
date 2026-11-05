import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, dayNumber, isToday, weekdayShort } from "../lib/dates";
import type { AwarenessUser } from "../types";

interface DateRailProps {
  date: string;
  onSelect(date: string): void;
  activity: Map<string, number>;
  footprints: Record<string, AwarenessUser[]>;
}

const SPAN_BEFORE = 7;
const SPAN_DAYS = 35;
const EDGE_DAYS = 5;

export function DateRail({ date, onSelect, activity, footprints }: DateRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState(date);

  // The rail keeps its window until the selected day approaches an edge, so
  // stepping through days moves the hairline selection instead of rebuilding
  // the whole strip under the thumb.
  useEffect(() => {
    if (date < addDays(anchor, EDGE_DAYS) || date > addDays(anchor, SPAN_DAYS - EDGE_DAYS)) {
      setAnchor(date);
    }
  }, [date, anchor]);

  const days = useMemo(
    () => Array.from({ length: SPAN_DAYS }, (_, index) => addDays(anchor, index - SPAN_BEFORE)),
    [anchor],
  );

  useEffect(() => {
    const container = scrollRef.current;
    const active = container?.querySelector<HTMLElement>('[data-active="true"]');
    if (!container || !active) return;
    const target = active.offsetLeft - container.clientWidth / 2 + active.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [date, anchor]);

  return (
    <div className="ds-rail" ref={scrollRef} role="tablist" aria-label="Dates">
      {days.map((day) => {
        const active = day === date;
        const live = footprints[day] ?? [];
        const count = activity.get(day) ?? 0;
        return (
          <button
            key={day}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${weekdayShort(day)} ${dayNumber(day)}`}
            data-active={active}
            className={`ds-rail-day ${active ? "is-active" : ""} ${
              isToday(day) ? "is-today" : ""
            }`}
            onClick={() => onSelect(day)}
          >
            <span className="ds-rail-weekday">{weekdayShort(day)}</span>
            <span className="ds-rail-number">{dayNumber(day)}</span>
            <span className="ds-rail-marks" aria-hidden="true">
              {live.slice(0, 3).map((user) => (
                <span
                  key={user.id}
                  className="ds-mark-dot ds-mark-dot--live"
                  style={{ background: user.color }}
                />
              ))}
              {count > 0 ? <span className="ds-mark-dot ds-mark-dot--ink" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
