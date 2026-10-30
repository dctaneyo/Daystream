import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    await query("SELECT 1 AS ok");
    return NextResponse.json({ ok: true, service: "daystream" });
  } catch {
    return NextResponse.json({ ok: false, service: "daystream", db: "unavailable" }, { status: 503 });
  }
}
