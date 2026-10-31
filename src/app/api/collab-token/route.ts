import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { colorForUser, signCollabToken } from "@/lib/collab-token";
import { getNoteForUser } from "@/lib/notes";
import { parseRoom } from "@/lib/rooms";
import { requireMembership } from "@/lib/workspaces";

/**
 * Mints the short-lived JWT that the Hocuspocus server verifies during the
 * WebSocket handshake. The browser never decides which workspace or note it may
 * join: notes are checked against note_members, days against workspace_members.
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

  let workspaceId: string;

  if (parsed.kind === "note") {
    const note = await getNoteForUser(parsed.noteId, userId);
    if (!note) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    workspaceId = note.workspaceId;
  } else {
    const workspace = await requireMembership(userId, parsed.workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    workspaceId = parsed.workspaceId;
  }

  const token = await signCollabToken({
    userId,
    workspaceId,
    room,
    name: session.user.name ?? session.user.email ?? "Someone",
    color: colorForUser(userId),
  });

  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
}
