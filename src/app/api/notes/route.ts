import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActiveWorkspace } from "@/lib/workspaces";
import { createNote } from "@/lib/notes";

/**
 * Creates an empty Note and hands its id back, so the client can finish the
 * capture it started: choosing a home and typing the first Thing are one action
 * (UX-33).
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const workspace = await resolveActiveWorkspace(userId);

  try {
    const note = await createNote({
      userId,
      workspaceId: workspace.id,
      title: title || "Untitled note",
    });
    return NextResponse.json({ id: note.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create the Note." },
      { status: 400 },
    );
  }
}
