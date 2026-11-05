import { useEffect, useMemo, useState } from "react";
import { addDays, fromKey, isToday, longDate, toKey } from "../lib/dates";
import { Icon } from "./Icon";

export function MonthCalendar({
  date,
  onPick,
}: {
  date: string;
  onPick(date: string): void;
}) {
  const [month, setMonth] = useState(() => date.slice(0, 7));

  useEffect(() => {
    setMonth(date.slice(0, 7));
  }, [date]);

  const first = `${month}-01`;
  const base = fromKey(first);
  const cells = useMemo(() => {
    const offset = (base.getDay() + 6) % 7;
    const start = addDays(first, -offset);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [base, first]);

  const monthLabel = base.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const shift = (delta: number) => {
    const next = fromKey(first);
    next.setMonth(next.getMonth() + delta);
    setMonth(toKey(next).slice(0, 7));
  };

  return (
    <div className="ds-calendar">
      <div className="ds-calendar-nav">
        <button
          type="button"
          className="ds-icon-btn"
          aria-label="Previous month"
          onClick={() => shift(-1)}
        >
          <Icon name="arrow-left" />
        </button>
        <span className="ds-calendar-month">{monthLabel}</span>
        <button
          type="button"
          className="ds-icon-btn"
          aria-label="Next month"
          onClick={() => shift(1)}
        >
          <Icon name="arrow-right" />
        </button>
      </div>

      <div className="ds-calendar-weekdays" aria-hidden="true">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="ds-calendar-grid" aria-label={monthLabel}>
        {cells.map((cell) => {
          const outside = cell.slice(0, 7) !== month;
          return (
            <button
              key={cell}
              type="button"
              className={`ds-calendar-day ${outside ? "is-outside" : ""} ${
                cell === date ? "is-active" : ""
              } ${isToday(cell) ? "is-today" : ""}`}
              aria-label={longDate(cell)}
              aria-pressed={cell === date}
              onClick={() => onPick(cell)}
            >
              {fromKey(cell).getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
