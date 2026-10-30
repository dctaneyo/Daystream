import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/app");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-6 py-16">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl bg-accent" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">Daystream</span>
        </div>
        <div className="w-32">
          <ThemeToggle compact />
        </div>
      </div>

      <h1 className="mt-10 max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
        Your day, captured as a stream.
      </h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
        Quick jot-downs, tasks and reminders that live on the day they happened — with a calendar
        that shows where the thinking was. Works offline, syncs in realtime, installs to your home
        screen. Sign in with a 6-digit ID and PIN; no password to fumble on a phone.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <Link href="/signup" className="ds-button ds-button-primary px-5 py-2.5">
          Create your notebook
        </Link>
        <Link href="/login" className="ds-button px-5 py-2.5">
          Sign in
        </Link>
      </div>

      <dl className="mt-16 grid gap-6 border-t border-edge pt-8 sm:grid-cols-3">
        {[
          ["Daily canvas", "Every note is a Thing, anchored to a date. Hover one to move it, task it, or bin it."],
          ["Local-first", "Writes land in IndexedDB first. The status pill tells you the truth about the server."],
          ["Realtime by default", "Yjs CRDTs over a self-hosted Hocuspocus server — presence included, no SaaS."],
        ].map(([title, body]) => (
          <div key={title}>
            <dt className="text-sm font-medium text-ink">{title}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-muted">{body}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
