import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  countThingsInNote,
  deleteNote,
  getNoteForUser,
  listNoteMembers,
  renameNote,
} from "@/lib/notes";

async function caller() {
  const session = await auth();
  const userId = session?.user?.id;
  return userId ? { userId } : null;
}

/** One Note's metadata, for the backlog sheet. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await caller();
  if (!who) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const note = await getNoteForUser(id, who.userId);
  if (!note) return NextResponse.json({ error: "No such Note." }, { status: 404 });

  const [members, thingCount] = await Promise.all([
    listNoteMembers(note.id),
    countThingsInNote(note.id),
  ]);

  return NextResponse.json(
    {
      id: note.id,
      title: note.title,
      thingCount,
      memberCount: members.length,
      isInbox: note.isInbox,
      canManage: note.canManage,
      sharedWithMe: note.sharedWithMe,
      members,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await caller();
  if (!who) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const note = await getNoteForUser(id, who.userId);
  if (!note) return NextResponse.json({ error: "No such Note." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!title) return NextResponse.json({ error: "Give the Note a name." }, { status: 400 });

  await renameNote(id, who.userId, title);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await caller();
  if (!who) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  await deleteNote(id, who.userId);
  return NextResponse.json({ ok: true });
}
