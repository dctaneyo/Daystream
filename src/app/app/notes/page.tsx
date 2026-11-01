import { redirect } from "next/navigation";
import { todayISO } from "@/lib/date";

/**
 * Notes are reached through the day they belong to, so a separate index would
 * be a second way to find the same thing (UX-23).
 */
export default function NotesIndexPage() {
  redirect(`/app/${todayISO()}`);
}
