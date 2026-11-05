import { Hocuspocus } from "@hocuspocus/server";
import { jwtVerify } from "jose";
import * as Y from "yjs";
import { query } from "./db.mjs";
import { secretKey } from "./auth.mjs";
import {
  COLLAB_AUDIENCE,
  COLLAB_ISSUER,
  parseRoom,
} from "./rooms.mjs";
import { readNoteText } from "./templates.mjs";

const debug = Boolean(process.env.DEBUG_WS);

async function membershipRole(workspaceId, userId) {
  const { rows } = await query(
    "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
    [workspaceId, userId],
  );
  return rows[0]?.role ?? null;
}

export const hocuspocus = new Hocuspocus({
  debounce: 1200,
  maxDebounce: 5000,

  async onAuthenticate({ token, documentName }) {
    if (!token) throw new Error("Missing collaboration token");

    let payload;
    try {
      ({ payload } = await jwtVerify(token, secretKey(), {
        issuer: COLLAB_ISSUER,
        audience: COLLAB_AUDIENCE,
      }));
    } catch {
      throw new Error("Invalid or expired collaboration token");
    }

    if (payload.typ !== "collab" || typeof payload.sub !== "string") {
      throw new Error("Invalid collaboration token");
    }
    // The token names its room, so access to one note can never be replayed
    // against another room.
    if (payload.room !== documentName) {
      throw new Error("Token is for a different room");
    }

    const room = parseRoom(documentName);
    if (!room) throw new Error("Unknown room");
    const userId = payload.sub;

    if (room.kind === "presence") {
      const role = await membershipRole(room.workspaceId, userId);
      if (!role) throw new Error("Not a member of this workspace");
      return { userId, workspaceId: room.workspaceId, presence: true };
    }

    const { rows } = await query(
      "SELECT id, workspace_id, user_id FROM notes WHERE id = $1",
      [room.noteId],
    );
    const note = rows[0];
    if (!note) throw new Error("Note not found");

    if (room.kind === "private") {
      if (note.user_id !== userId) throw new Error("Not your note");
      if (payload.wid && payload.wid !== note.workspace_id) {
        throw new Error("Token does not match this note");
      }
    } else {
      if (note.workspace_id !== room.workspaceId) {
        throw new Error("Token does not match this note");
      }
      const role = await membershipRole(room.workspaceId, userId);
      if (!role) {
        // A note share is the narrow exception to workspace membership: it
        // admits the socket to this one note room, never presence or siblings.
        const { rowCount } = await query(
          "SELECT 1 FROM note_shares WHERE note_id = $1 AND user_id = $2",
          [note.id, userId],
        );
        if (!rowCount) throw new Error("Not a member of this workspace");
      }
    }

    if (debug) console.log("[collab] authenticated", documentName, userId);
    return { userId, noteId: note.id, workspaceId: note.workspace_id };
  },

  async onLoadDocument({ document, documentName }) {
    const room = parseRoom(documentName);
    if (!room || room.kind === "presence") return document;

    const { rows } = await query("SELECT content FROM notes WHERE id = $1", [
      room.noteId,
    ]);
    const state = rows[0]?.content;
    if (state?.length) {
      Y.applyUpdate(document, new Uint8Array(state));
    }
    return document;
  },

  async onStoreDocument({ document, documentName }) {
    const room = parseRoom(documentName);
    if (!room || room.kind === "presence") return;

    const state = Buffer.from(Y.encodeStateAsUpdate(document));
    const { title, excerpt } = readNoteText(document);
    await query(
      `UPDATE notes
          SET content = $2, title = $3, excerpt = $4, updated_at = now()
        WHERE id = $1`,
      [room.noteId, state, title, excerpt],
    );
    if (debug) console.log("[collab] stored", documentName);
  },

  async onDisconnect({ documentName }) {
    if (debug) console.log("[collab] disconnect", documentName);
  },
});

export async function closeCollab() {
  try {
    await hocuspocus.destroy();
  } catch {
    /* engine already stopped */
  }
}
