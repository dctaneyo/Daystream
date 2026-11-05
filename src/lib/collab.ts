import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { api } from "./api";
import type { AwarenessUser, Footprint } from "../types";

export function collabUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/collab`;
}

export interface NoteSession {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  destroy(): void;
}

export interface PresenceSession {
  provider: HocuspocusProvider;
  update(footprint: Footprint): void;
  destroy(): void;
}

interface TokenResponse {
  token: string;
  room: string;
}

/**
 * A note is cached in IndexedDB under its own key before the first keystroke, so
 * the editor paints and accepts text at local speed; the Yjs document syncs to
 * Postgres in the background and catches up on reconnect.
 */
export async function openNoteSession(
  noteId: string,
  user: AwarenessUser,
): Promise<NoteSession> {
  const { token, room } = await api<TokenResponse>(
    `/collab/token?noteId=${encodeURIComponent(noteId)}`,
  );

  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`daystream.note.${noteId}`, doc);
  const provider = new HocuspocusProvider({
    url: collabUrl(),
    name: room,
    document: doc,
    token,
  });

  const publish = () => {
    provider.awareness?.setLocalStateField("user", user);
  };
  publish();
  provider.on("synced", publish);

  return {
    doc,
    provider,
    destroy() {
      provider.off("synced", publish);
      provider.destroy();
      persistence.destroy();
      doc.destroy();
    },
  };
}

/**
 * Layer 1 presence: one awareness-only room per workspace. Every open client
 * publishes { user, footprint: { date, noteId } }; the date rail reads these to
 * draw footprint dots without a single database write.
 */
export async function openPresenceSession(
  workspaceId: string,
  user: AwarenessUser,
): Promise<PresenceSession> {
  const { token, room } = await api<TokenResponse>(
    `/collab/token?workspaceId=${encodeURIComponent(workspaceId)}`,
  );

  const doc = new Y.Doc();
  const provider = new HocuspocusProvider({
    url: collabUrl(),
    name: room,
    document: doc,
    token,
  });

  let current: Footprint = { date: "", noteId: null };
  provider.awareness?.setLocalStateField("user", user);
  provider.on("synced", () => {
    provider.awareness?.setLocalStateField("user", user);
    provider.awareness?.setLocalStateField("footprint", current);
  });

  return {
    provider,
    update(footprint) {
      current = footprint;
      provider.awareness?.setLocalStateField("footprint", footprint);
    },
    destroy() {
      provider.destroy();
      doc.destroy();
    },
  };
}
