import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PinSignup } from "@/components/PinSignup";

export const metadata = { title: "Create account" };
export default async function SignupPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/app");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10">
      <Link href="/" className="self-start text-sm text-muted hover:text-ink">
        ← Daystream
      </Link>
      <h1 className="mt-7 text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted">
        Six digits gets you in on any device. No email or password.
      </p>

      <div className="mt-6">
        <PinSignup />
      </div>
    </main>
  );
}
