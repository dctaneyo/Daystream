import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PinLogin } from "@/components/PinLogin";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) redirect("/app");

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10">
      <Link href="/" className="self-start text-sm text-muted hover:text-ink">
        ← Daystream
      </Link>
      <h1 className="mt-7 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1.5 text-sm text-muted">Your ID and PIN. That&apos;s it.</p>

      <div className="mt-6">
        <PinLogin
          initialError={error === "created" ? "Account created — enter your ID and PIN." : null}
        />
      </div>
    </main>
  );
}
