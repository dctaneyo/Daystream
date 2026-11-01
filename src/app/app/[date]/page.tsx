import { notFound, redirect } from "next/navigation";
import { isISODate, todayISO } from "@/lib/date";

/** Days are a parameter of the one view, not a route of their own (UX-23). */
export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isISODate(date)) notFound();
  redirect(date === todayISO() ? "/app" : `/app?d=${date}`);
}
