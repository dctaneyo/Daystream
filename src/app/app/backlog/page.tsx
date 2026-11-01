import { redirect } from "next/navigation";

/** The backlog is a sheet over the day, not a destination (UX-23). */
export default function BacklogPage() {
  redirect("/app?sheet=inbox");
}
