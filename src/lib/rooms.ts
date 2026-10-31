/**
 * Room names are the unit of realtime sync and persistence.
 *   `${workspaceId}:${YYYY-MM-DD}`  -> one day of notes
 *   `${workspaceId}:backlog`        -> undated items parked for later
 *   `note:${noteId}`                -> a standalone note made of Things
 */
export const BACKLOG = "backlog";
export const NOTE_PREFIX = "note:";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RoomRef =
  | { kind: "day"; workspaceId: string; date: string }
  | { kind: "backlog"; workspaceId: string; date: null }
  | { kind: "note"; noteId: string };

export function dayRoom(workspaceId: string, date: string): string {
  return `${workspaceId}:${date}`;
}

export function backlogRoom(workspaceId: string): string {
  return `${workspaceId}:${BACKLOG}`;
}

export function noteRoom(noteId: string): string {
  return `${NOTE_PREFIX}${noteId}`;
}

export function parseRoom(room: string): RoomRef | null {
  if (room.startsWith(NOTE_PREFIX)) {
    const noteId = room.slice(NOTE_PREFIX.length);
    return UUID.test(noteId) ? { kind: "note", noteId } : null;
  }

  const index = room.indexOf(":");
  if (index === -1) return null;
  const workspaceId = room.slice(0, index);
  const date = room.slice(index + 1);
  if (!UUID.test(workspaceId)) return null;
  if (date === BACKLOG) return { kind: "backlog", workspaceId, date: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { kind: "day", workspaceId, date };
}
