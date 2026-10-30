"use server";

import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";
import { getLoginState } from "@/lib/auth-pin";
import { query } from "@/lib/db";
import { isSixDigits } from "@/lib/pin";
import type { ActionState } from "@/lib/action-types";
import { createUserRecord, setUserPin, verifyUserPin } from "@/lib/users";
import { createWorkspace } from "@/lib/workspaces";

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function pinLoginAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const publicId = String(formData.get("userId") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!isSixDigits(publicId)) return { error: "Your Daystream ID is 6 digits." };
  if (!isSixDigits(pin)) return { error: "Your PIN is 6 digits." };

  try {
    await signIn("credentials", { userId: publicId, pin, redirectTo: "/app" });
    return { error: null };
  } catch (error) {
    if (isNextRedirect(error)) throw error;

    const state = await getLoginState(publicId);
    if (state.lockedSeconds > 0) {
      const minutes = Math.ceil(state.lockedSeconds / 60);
      return {
        error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      };
    }
    if (state.suspended) return { error: "That account is suspended. Ask your admin." };
    return { error: "That ID and PIN don't match." };
  }
}

export async function signUpPinAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const workspaceName = String(formData.get("workspace") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "").trim();

  if (name.length < 2) return { error: "Tell us what to call you." };
  if (!isSixDigits(pin)) return { error: "Choose a 6-digit PIN." };
  if (pin !== confirm) return { error: "Those PINs don't match." };
  if (/^(\d)\1{5}$/.test(pin)) return { error: "Avoid a repeated digit like 111111." };

  const { rows } = await query<{ count: string }>("SELECT count(*)::text AS count FROM users");
  const isFirstUser = Number(rows[0]?.count ?? "0") === 0;

  let created: { id: string; publicId: string };
  try {
    created = await createUserRecord({
      name,
      pin,
      isAdmin: isFirstUser,
      createdBy: null,
    });
  } catch {
    return { error: "Could not create your account. Try again." };
  }

  await createWorkspace(created.id, workspaceName.slice(0, 40) || "Personal");

  try {
    await signIn("credentials", { userId: created.publicId, pin, redirectTo: "/welcome" });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirect("/login?error=created");
  }
  return { error: null };
}

export async function changePinAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Your session expired. Sign in again." };

  const current = String(formData.get("current") ?? "").trim();
  const next = String(formData.get("next") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "").trim();

  if (!isSixDigits(current)) return { error: "Enter your current 6-digit PIN." };
  if (!isSixDigits(next)) return { error: "Your new PIN must be 6 digits." };
  if (next !== confirm) return { error: "The new PINs don't match." };
  if (next === current) return { error: "Pick a different PIN." };

  if (!(await verifyUserPin(userId, current))) return { error: "That current PIN is wrong." };

  await setUserPin(userId, next);
  return { ok: true, message: "PIN updated." };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
