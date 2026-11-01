import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActiveWorkspace } from "@/lib/workspaces";
import { createNote } from "@/lib/notes";
import { isISODate } from "@/lib/date";

/** Creates a Note on a day. The client adds it to the view without navigating. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { title?: unknown; day?: unknown }
    | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const day = typeof body?.day === "string" && isISODate(body.day) ? body.day : undefined;
  const workspace = await resolveActiveWorkspace(userId);

  try {
    const note = await createNote({
      userId,
      workspaceId: workspace.id,
      title: title || "Untitled note",
      day,
    });
    return NextResponse.json({ id: note.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create the Note." },
      { status: 400 },
    );
  }
}
