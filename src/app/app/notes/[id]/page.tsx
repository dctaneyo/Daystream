import { redirect } from "next/navigation";

/** A Note has no page of its own: it is edited where it lives, in the day (UX-23). */
export default function NotePage() {
  redirect("/app");
}
