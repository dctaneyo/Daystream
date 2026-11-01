import { query } from "@/lib/db";

export type DayCount = { date: string; count: number };

/**
 * Per-day Thing counts for one month. A Thing's day is its own when it has one
 * (backlog room) and its Note's otherwise, because Things live in Notes now.
 */
export async function monthActivity(workspaceId: string, month: string): Promise<DayCount[]> {
  const { rows } = await query<{ date: string; count: string }>(
    `SELECT to_char(COALESCE(t.room_date, n.day), 'YYYY-MM-DD') AS date, COUNT(*) AS count
       FROM things t
       JOIN notes n ON n.id = t.note_id
      WHERE t.workspace_id = $1
        AND COALESCE(t.room_date, n.day) >= $2::date
        AND COALESCE(t.room_date, n.day) < ($2::date + interval '1 month')
      GROUP BY 1
      ORDER BY 1 ASC`,
    [workspaceId, `${month}-01`],
  );
  return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
}

export type SearchHit = {
  id: string;
  /** The day the Thing belongs to, or null for the backlog. */
  day: string | null;
  room_date: string | null;
  type: string;
  content: string;
  is_completed: boolean;
  note_id: string | null;
  note_title: string | null;
};

export async function searchThings(
  workspaceId: string,
  term: string,
  limit = 80,
): Promise<SearchHit[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];
  const { rows } = await query<SearchHit>(
    `SELECT t.id,
            to_char(COALESCE(t.room_date, n.day), 'YYYY-MM-DD') AS day,
            to_char(t.room_date, 'YYYY-MM-DD') AS room_date,
            t.type,
            t.content,
            t.is_completed,
            t.note_id,
            n.title AS note_title
       FROM things t
       JOIN notes n ON n.id = t.note_id
      WHERE t.workspace_id = $1
        AND t.content ILIKE '%' || $2 || '%'
      ORDER BY COALESCE(t.room_date, n.day) DESC NULLS LAST, t.sort_order ASC
      LIMIT $3`,
    [workspaceId, trimmed, limit],
  );
  return rows;
}

/** Items from the last N days that are still open — the roll-up view. */
export async function recentOpenTasks(workspaceId: string, days = 7): Promise<SearchHit[]> {
  const { rows } = await query<SearchHit>(
    `SELECT t.id,
            to_char(COALESCE(t.room_date, n.day), 'YYYY-MM-DD') AS day,
            to_char(t.room_date, 'YYYY-MM-DD') AS room_date,
            t.type,
            t.content,
            t.is_completed,
            t.note_id,
            n.title AS note_title
       FROM things t
       JOIN notes n ON n.id = t.note_id
      WHERE t.workspace_id = $1
        AND t.is_completed = false
        AND t.type IN ('todo', 'reminder')
        AND COALESCE(t.room_date, n.day) >= (CURRENT_DATE - ($2::int - 1))
      ORDER BY COALESCE(t.room_date, n.day) DESC, t.sort_order ASC`,
    [workspaceId, days],
  );
  return rows;
}
