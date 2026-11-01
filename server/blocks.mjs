import * as Y from "yjs";

/**
 * Server-side mirror of src/lib/blocks.ts. The collab server runs as plain
 * ESM (no build step), so it keeps its own tiny reader for the Yjs projection.
 */
export const BLOCKS_KEY = "blocks";

export function readBlocks(doc) {
  const array = doc.getArray(BLOCKS_KEY);
  const blocks = [];
  array.forEach((map) => {
    if (!(map instanceof Y.Map)) return;
    const id = map.get("id");
    if (typeof id !== "string" || id.length === 0) return;
    const rawType = map.get("type");
    const content = map.get("content");
    blocks.push({
      id,
      type: ["text", "todo", "reminder"].includes(rawType) ? rawType : "text",
      content: typeof content === "string" ? content : "",
      done: map.get("done") === true,
      createdAt: typeof map.get("createdAt") === "number" ? map.get("createdAt") : 0,
      createdBy: typeof map.get("createdBy") === "string" ? map.get("createdBy") : null,
    });
  });
  return blocks;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mirrors src/lib/rooms.ts: day, backlog and standalone-note rooms. */
export function parseRoom(room) {
  if (room.startsWith("note:")) {
    const noteId = room.slice("note:".length);
    return UUID.test(noteId) ? { kind: "note", noteId } : null;
  }

  const index = room.indexOf(":");
  if (index === -1) return null;
  const workspaceId = room.slice(0, index);
  const date = room.slice(index + 1);
  if (!UUID.test(workspaceId)) return null;
  if (date === "backlog") return { kind: "backlog", workspaceId, date: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { kind: "day", workspaceId, date };
}
