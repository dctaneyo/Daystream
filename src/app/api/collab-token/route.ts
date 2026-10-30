import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { colorForUser, signCollabToken } from "@/lib/collab-token";
import { parseRoom } from "@/lib/rooms";
import { requireMembership } from "@/lib/workspaces";

/**
 * Mints the short-lived JWT that the Hocuspocus server verifies during the
 * WebSocket handshake. The browser never decides which workspace it may join.
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const room = new URL(request.url).searchParams.get("room") ?? "";
  const parsed = parseRoom(room);
  if (!parsed) {
    return NextResponse.json({ error: "invalid room" }, { status: 400 });
  }

  const workspace = await requireMembership(userId, parsed.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const token = await signCollabToken({
    userId,
    workspaceId: parsed.workspaceId,
    name: session.user.name ?? session.user.email ?? "Someone",
    color: colorForUser(userId),
  });

  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
}
