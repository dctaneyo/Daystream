import { Hocuspocus } from "@hocuspocus/server";
import { jwtVerify } from "jose";
import pg from "pg";
import * as Y from "yjs";
import { readBlocks, parseRoom } from "./blocks.mjs";

const ISSUER = "daystream";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Rewrites the SQL projection of one room: `things` mirrors the Yjs document so
 * calendar heat-maps, search and roll-ups never have to decode CRDT state.
 * Only day and backlog rooms project — notes live purely in their Yjs document.
 */
async function projectRoom({ workspaceId, date }, blocks) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (date) {
      await client.query(
        "DELETE FROM things WHERE workspace_id = $1 AND room_date = $2",
        [workspaceId, date],
      );
    } else {
      await client.query(
        "DELETE FROM things WHERE workspace_id = $1 AND room_date IS NULL",
        [workspaceId],
      );
    }

    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      if (!block.content.trim() && block.type === "text") continue;
      await client.query(
        `INSERT INTO things
           (id, workspace_id, room_date, sort_order, type, content, is_completed, created_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT id FROM users WHERE id = $8), now())
         ON CONFLICT (id) DO UPDATE SET
           workspace_id = EXCLUDED.workspace_id,
           room_date = EXCLUDED.room_date,
           sort_order = EXCLUDED.sort_order,
           type = EXCLUDED.type,
           content = EXCLUDED.content,
           is_completed = EXCLUDED.is_completed,
           updated_at = now()`,
        [
          block.id,
          workspaceId,
          date,
          index,
          block.type,
          block.content,
          block.done,
          block.createdBy,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const debug = Boolean(process.env.DEBUG_WS);

// Hocuspocus 4 splits the sync engine (Hocuspocus) from its own HTTP listener
// (Server). We only need the engine: the custom server owns the socket.
export const hocuspocus = new Hocuspocus({
  async onConnect({ documentName }) {
    if (debug) console.log("[collab] connect", documentName);
  },

  async onAuthenticate({ token, documentName }) {
    if (debug) console.log("[collab] authenticate", documentName, token ? "token" : "no-token");
    if (!token) throw new Error("Missing collab token");
    let payload;
    try {
      ({ payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER }));
    } catch {
      throw new Error("Invalid or expired collab token");
    }

    const room = parseRoom(documentName);
    if (!room) throw new Error("Unknown room");
    if (typeof payload.sub !== "string") throw new Error("Token is missing a subject");
    // The token names its room, so access to one note can never open another.
    if (payload.room !== documentName) throw new Error("Token is for a different room");

    const userId = payload.sub;
    let workspaceId;

    if (room.kind === "note") {
      const { rows } = await pool.query(
        `SELECT n.workspace_id
           FROM notes n
          WHERE n.id = $1
            AND n.workspace_id = $2
            AND (EXISTS (SELECT 1 FROM workspace_members wm
                          WHERE wm.workspace_id = n.workspace_id AND wm.user_id = $3)
                 OR EXISTS (SELECT 1 FROM note_members nm
                             WHERE nm.note_id = n.id AND nm.user_id = $3))`,
        [room.noteId, payload.wid, userId],
      );
      if (rows.length === 0) throw new Error("No access to this note");
      workspaceId = rows[0].workspace_id;
    } else {
      if (payload.wid !== room.workspaceId) throw new Error("Token does not match workspace");
      const { rows } = await pool.query(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        [room.workspaceId, userId],
      );
      if (rows.length === 0) throw new Error("Not a member of this workspace");
      workspaceId = room.workspaceId;
    }

    if (debug) console.log("[collab] authenticated", workspaceId, room.kind);

    return {
      userId,
      name: String(payload.name ?? ""),
      color: String(payload.color ?? "#7c8cff"),
      workspaceId,
      date: room.kind === "day" ? room.date : null,
    };
  },

  async onLoadDocument({ document, documentName }) {
    if (debug) console.log("[collab] load", documentName);
    const { rows } = await pool.query(
      "SELECT state FROM yjs_documents WHERE room_name = $1",
      [documentName],
    );
    const state = rows[0]?.state;
    if (state) {
      Y.applyUpdate(document, new Uint8Array(state));
    }
    return document;
  },

  async onStoreDocument({ document, documentName }) {
    if (debug) console.log("[collab] store", documentName);
    const room = parseRoom(documentName);
    if (!room) return;

    let workspaceId = room.workspaceId ?? null;
    if (room.kind === "note") {
      const { rows } = await pool.query("SELECT workspace_id FROM notes WHERE id = $1", [
        room.noteId,
      ]);
      if (!rows[0]) return;
      workspaceId = rows[0].workspace_id;
    }

    const state = Buffer.from(Y.encodeStateAsUpdate(document));
    await pool.query(
      `INSERT INTO yjs_documents (room_name, workspace_id, state, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (room_name) DO UPDATE
         SET state = EXCLUDED.state, updated_at = now()`,
      [documentName, workspaceId, state],
    );

    if (room.kind !== "note") {
      await projectRoom({ workspaceId, date: room.date }, readBlocks(document));
    }
  },

  async onDisconnect({ documentName }) {
    if (debug) console.log("[collab] disconnect", documentName);
    // Hocuspocus stores on unload; this keeps the projection warm for
    // calendar queries after the last editor leaves.
    void documentName;
  },
});

export async function closeCollab() {
  try {
    await hocuspocus.destroy();
  } catch {
    // engine already stopped
  }
  await pool.end();
}
