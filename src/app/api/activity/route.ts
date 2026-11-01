import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActiveWorkspace } from "@/lib/workspaces";
import { monthActivity } from "@/lib/activity";
import { isValidMonth } from "@/lib/date";

/** Per-day counts for the month sheet. Read on demand; never polled. */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const month = new URL(request.url).searchParams.get("m") ?? "";
  if (!isValidMonth(month)) {
    return NextResponse.json({ error: "That is not a month." }, { status: 400 });
  }

  const workspace = await resolveActiveWorkspace(userId);
  const days = await monthActivity(workspace.id, month);
  const heat: Record<string, number> = {};
  for (const entry of days) heat[entry.date] = entry.count;

  return NextResponse.json({ heat }, { headers: { "Cache-Control": "no-store" } });
}
