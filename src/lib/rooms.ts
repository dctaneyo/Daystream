/**
 * Room names are the unit of realtime sync and persistence.
 *   `${workspaceId}:${YYYY-MM-DD}`  -> one day of notes
 *   `${workspaceId}:backlog`        -> undated items parked for later
 */
export const BACKLOG = "backlog";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RoomRef = { workspaceId: string; date: string | null };

export function dayRoom(workspaceId: string, date: string): string {
  return `${workspaceId}:${date}`;
}

export function backlogRoom(workspaceId: string): string {
  return `${workspaceId}:${BACKLOG}`;
}

export function parseRoom(room: string): RoomRef | null {
  const index = room.indexOf(":");
  if (index === -1) return null;
  const workspaceId = room.slice(0, index);
  const date = room.slice(index + 1);
  if (!UUID.test(workspaceId)) return null;
  if (date === BACKLOG) return { workspaceId, date: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { workspaceId, date };
}
