import { SignJWT, jwtVerify } from "jose";

export const COLLAB_ISSUER = "daystream";

export type CollabClaims = {
  userId: string;
  workspaceId: string;
  room: string;
  name: string;
  color: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short (see .env.example)");
  }
  return new TextEncoder().encode(secret);
}

/**
 * The token names the exact room it was minted for. The collab server rejects a
 * token presented on any other room, so access to one note never leaks access to
 * a sibling note in the same workspace.
 */
export async function signCollabToken(claims: CollabClaims): Promise<string> {
  return new SignJWT({
    wid: claims.workspaceId,
    room: claims.room,
    name: claims.name,
    color: claims.color,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuer(COLLAB_ISSUER)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey());
}

export async function verifyCollabToken(token: string): Promise<CollabClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: COLLAB_ISSUER });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.wid !== "string" ||
      typeof payload.room !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.color !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.sub,
      workspaceId: payload.wid,
      room: payload.room,
      name: payload.name,
      color: payload.color,
    };
  } catch {
    return null;
  }
}

export { colorForUser } from "@/lib/colors";
