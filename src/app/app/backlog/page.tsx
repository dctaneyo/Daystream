import { redirect } from "next/navigation";
import { todayISO } from "@/lib/date";

/**
 * There is no separate backlog any more: Notes belong to a day, and a Thing is
 * created inside a Note (UX-23, UX-33). Old links land on today.
 */
export default function BacklogPage() {
  redirect(`/app/${todayISO()}`);
}
