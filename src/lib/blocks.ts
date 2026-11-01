import * as Y from "yjs";

/** The Yjs array key holding every block ("Thing") for a room. */
export const BLOCKS_KEY = "blocks";

/**
 * `toggle` used to live here with no behaviour attached to it; documents that
 * still carry it read back as text, which is what it always looked like.
 */
export type BlockType = "text" | "todo" | "reminder";

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  done: boolean;
  createdAt: number;
  createdBy: string | null;
}

export const BLOCK_TYPES: BlockType[] = ["text", "todo", "reminder"];

/**
 * Each block is a Y.Map inside an ordered Y.Array, so structure and ordering
 * merge without conflicts. Block *content* is a plain string field: concurrent
 * edits to the same block resolve last-writer-wins per field, which is fine for
 * a daily log. Swapping `content` to a Y.Text is the upgrade path for
 * character-level merging inside a single block.
 */
export function readBlocks(doc: Y.Doc): Block[] {
  const array = doc.getArray<Y.Map<unknown>>(BLOCKS_KEY);
  const blocks: Block[] = [];
  array.forEach((map) => {
    if (!(map instanceof Y.Map)) return;
    const id = map.get("id");
    if (typeof id !== "string" || id.length === 0) return;
    const rawType = map.get("type");
    blocks.push({
      id,
      type: BLOCK_TYPES.includes(rawType as BlockType) ? (rawType as BlockType) : "text",
      content: typeof map.get("content") === "string" ? (map.get("content") as string) : "",
      done: map.get("done") === true,
      createdAt: typeof map.get("createdAt") === "number" ? (map.get("createdAt") as number) : 0,
      createdBy: typeof map.get("createdBy") === "string" ? (map.get("createdBy") as string) : null,
    });
  });
  return blocks;
}

export function createBlockMap(input: {
  id: string;
  type: BlockType;
  content: string;
  createdAt: number;
  createdBy: string | null;
}): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  map.set("id", input.id);
  map.set("type", input.type);
  map.set("content", input.content);
  map.set("done", false);
  map.set("createdAt", input.createdAt);
  map.set("createdBy", input.createdBy);
  return map;
}

export function newBlockId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Text used for search/roll-ups; markdown-ish prefixes are preserved. */
export function blockPlainText(block: Block): string {
  return block.content.replace(/\[\[([^\]]+)\]\]/g, "$1").trim();
}
