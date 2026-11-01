import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActiveWorkspace } from "@/lib/workspaces";
import { searchThings } from "@/lib/activity";

/** Search is read on demand by the overlay, never polled. */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const term = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (term.length < 2) return NextResponse.json({ hits: [] });

  const workspace = await resolveActiveWorkspace(userId);
  const hits = await searchThings(workspace.id, term);
  return NextResponse.json({ hits }, { headers: { "Cache-Control": "no-store" } });
}
