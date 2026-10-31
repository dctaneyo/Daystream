/**
 * Everything that travels over Yjs awareness: who is in the room, and where
 * their caret currently sits inside one Thing.
 *
 * Awareness is ephemeral by design — it is never written to the document — so a
 * dropped socket simply removes the peer from the map.
 */
export type Peer = { id: number; name: string; color: string };

export type PeerCursor = Peer & { start: number; end: number };

/** Block id -> the remote carets inside that block. */
export type CursorMap = Record<string, PeerCursor[]>;

export type AwarenessCursor = { blockId: string; start: number; end: number };
