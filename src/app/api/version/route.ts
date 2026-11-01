import { NextResponse } from "next/server";
import { buildId } from "@/lib/build-id";

export const dynamic = "force-dynamic";

/** What the server is serving right now, for clients that are comparing (UX-34). */
export async function GET() {
  return NextResponse.json(
    { id: buildId() },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
