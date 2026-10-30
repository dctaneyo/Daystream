import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const metadata = { title: "Welcome" };
export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">You&apos;re in</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Save this ID, {session.user.name?.split(" ")[0] ?? "friend"}.
      </h1>

      <div className="mt-6 rounded-2xl border border-edge bg-panel px-5 py-6 text-center">
        <p className="text-xs uppercase tracking-wider text-muted">Daystream ID</p>
        <p className="mt-2 font-mono text-4xl font-semibold tracking-[0.35em] text-ink">
          {session.user.publicId}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Sign in with this ID and the 6-digit PIN you just chose. You can change the PIN any time
          in Settings.
        </p>
      </div>

      {session.user.isAdmin ? (
        <p className="mt-4 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-xs leading-relaxed text-ink">
          You&apos;re the first account, so you&apos;re an admin. The admin console lives at{" "}
          <Link href="/admin" className="underline decoration-edge underline-offset-2">
            /admin
          </Link>{" "}
          and is completely separate from your notes.
        </p>
      ) : null}

      <Link href="/app" className="ds-button ds-button-primary mt-6 py-2.5">
        Open Daystream
      </Link>
      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        On iPhone: Share → Add to Home Screen. On Android: menu → Install app. It runs full-screen
        like a native app.
      </p>
    </main>
  );
}
