import Link from "next/link";
import { monthLabel, shiftMonth, weekdayInitials, type CalendarCell } from "@/lib/date";
import { backlogRoom } from "@/lib/rooms";
import { Scratchpad } from "@/components/Scratchpad";

export function CalendarPanel({
  month,
  activeDate,
  cells,
  heat,
  workspaceName,
  workspaceId,
  userId,
}: {
  month: string;
  activeDate: string;
  cells: CalendarCell[];
  heat: Record<string, number>;
  workspaceName: string;
  workspaceId: string;
  userId: string;
}) {
  const peak = Math.max(1, ...Object.values(heat));

  const intensity = (count: number) => {
    if (count === 0) return "bg-edge/60";
    const ratio = count / peak;
    if (ratio > 0.66) return "bg-accent";
    if (ratio > 0.33) return "bg-accent/65";
    return "bg-accent/35";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{workspaceName}</p>
        <div className="flex items-center gap-1">
          <Link
            href={`/app/${activeDate}?m=${shiftMonth(month, -1)}`}
            aria-label="Previous month"
            className="rounded-md px-1.5 py-0.5 text-sm text-muted hover:bg-raised hover:text-ink"
          >
            ‹
          </Link>
          <Link
            href={`/app/${activeDate}?m=${shiftMonth(month, 1)}`}
            aria-label="Next month"
            className="rounded-md px-1.5 py-0.5 text-sm text-muted hover:bg-raised hover:text-ink"
          >
            ›
          </Link>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">{monthLabel(month)}</p>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-muted">
          {weekdayInitials().map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const count = heat[cell.date] ?? 0;
            const active = cell.date === activeDate;
            return (
              <Link
                key={cell.date}
                href={`/app/${cell.date}?m=${month}`}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition ${
                  active
                    ? "bg-accent text-accent-ink font-semibold"
                    : cell.inMonth
                      ? "text-ink hover:bg-raised"
                      : "text-muted/40 hover:bg-raised/50"
                } ${cell.isToday && !active ? "ring-1 ring-inset ring-accent/60" : ""}`}
                aria-label={`${cell.date}${count ? `, ${count} things` : ""}`}
              >
                <span>{Number(cell.date.slice(-2))}</span>
                {count > 0 && (
                  <span
                    aria-hidden
                    className={`mt-0.5 h-1 w-1 rounded-full ${active ? "bg-black/70" : intensity(count)}`}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <Scratchpad room={backlogRoom(workspaceId)} userId={userId} />
    </div>
  );
}
