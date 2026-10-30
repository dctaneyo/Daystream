import { query } from "@/lib/db";

export type DayCount = { date: string; count: number };

/** Per-day block counts for one month, used by the calendar heat-map. */
export async function monthActivity(workspaceId: string, month: string): Promise<DayCount[]> {
  const { rows } = await query<{ date: string; count: string }>(
    `SELECT to_char(room_date, 'YYYY-MM-DD') AS date, COUNT(*) AS count
       FROM things
      WHERE workspace_id = $1
        AND room_date >= $2::date
        AND room_date < ($2::date + interval '1 month')
      GROUP BY room_date
      ORDER BY room_date ASC`,
    [workspaceId, `${month}-01`],
  );
  return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
}

export type SearchHit = {
  id: string;
  room_date: string | null;
  type: string;
  content: string;
  is_completed: boolean;
};

export async function searchThings(
  workspaceId: string,
  term: string,
  limit = 80,
): Promise<SearchHit[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];
  const { rows } = await query<SearchHit>(
    `SELECT id, to_char(room_date, 'YYYY-MM-DD') AS room_date, type, content, is_completed
       FROM things
      WHERE workspace_id = $1
        AND content ILIKE '%' || $2 || '%'
      ORDER BY room_date DESC NULLS LAST, sort_order ASC
      LIMIT $3`,
    [workspaceId, trimmed, limit],
  );
  return rows;
}

/** Items from the last N days that are still open — the roll-up view. */
export async function recentOpenTasks(workspaceId: string, days = 7): Promise<SearchHit[]> {
  const { rows } = await query<SearchHit>(
    `SELECT id, to_char(room_date, 'YYYY-MM-DD') AS room_date, type, content, is_completed
       FROM things
      WHERE workspace_id = $1
        AND is_completed = false
        AND type IN ('todo', 'reminder')
        AND room_date >= (CURRENT_DATE - ($2::int - 1))
      ORDER BY room_date DESC, sort_order ASC`,
    [workspaceId, days],
  );
  return rows;
}
