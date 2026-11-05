const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PRIVATE_RE = new RegExp(`^private-(${UUID})$`, "i");
const SHARED_RE = new RegExp(`^shared-(${UUID})-(${UUID})$`, "i");
const PRESENCE_RE = new RegExp(`^presence-(${UUID})$`, "i");
const UUID_RE = new RegExp(`^${UUID}$`, "i");

export const COLLAB_ISSUER = "daystream";
export const COLLAB_AUDIENCE = "daystream-collab";

export const isUuid = (value) =>
  typeof value === "string" && UUID_RE.test(value);

export function privateRoom(noteId) {
  return `private-${noteId}`;
}

export function sharedRoom(workspaceId, noteId) {
  return `shared-${workspaceId}-${noteId}`;
}

export function presenceRoom(workspaceId) {
  return `presence-${workspaceId}`;
}

/**
 * Room names are the unit of authorization. The server never trusts a client's
 * claim about which room it belongs to: the name itself is parsed here and the
 * matching row plus membership are checked again before a socket is accepted.
 */
export function parseRoom(name) {
  let match = PRIVATE_RE.exec(name);
  if (match) return { kind: "private", noteId: match[1].toLowerCase() };

  match = SHARED_RE.exec(name);
  if (match) {
    return {
      kind: "shared",
      workspaceId: match[1].toLowerCase(),
      noteId: match[2].toLowerCase(),
    };
  }

  match = PRESENCE_RE.exec(name);
  if (match) return { kind: "presence", workspaceId: match[1].toLowerCase() };

  return null;
}
