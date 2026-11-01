import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadDayView } from "@/lib/day-view";
import { isISODate } from "@/lib/date";

/** Switching day happens in place, so it needs the next day's payload as data. */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const day = new URL(request.url).searchParams.get("d") ?? "";
  if (!isISODate(day)) {
    return NextResponse.json({ error: "That is not a day." }, { status: 400 });
  }

  const view = await loadDayView(userId, day);
  return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
}
