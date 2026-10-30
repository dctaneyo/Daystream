"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import type { ActionState } from "@/lib/action-types";
import { isSixDigits, randomPin } from "@/lib/pin";
import {
  countAdmins,
  createUserRecord,
  deleteUser,
  setUserAdmin,
  setUserPin,
  setUserStatus,
  writeAudit,
} from "@/lib/users";
import { createWorkspace } from "@/lib/workspaces";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isAdmin) redirect("/app");
  return session;
}

function refreshAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/workspaces");
  revalidatePath("/admin/audit");
}

export async function createUserAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const workspaceName = String(formData.get("workspace") ?? "").trim();
  const requestedPin = String(formData.get("pin") ?? "").trim();
  const makeAdmin = formData.get("isAdmin") === "on";

  if (name.length < 2) return { error: "Enter a name." };
  if (requestedPin && !isSixDigits(requestedPin)) return { error: "PIN must be exactly 6 digits." };
  if (email && !email.includes("@")) return { error: "That email doesn't look right." };

  const pin = requestedPin || randomPin();

  try {
    const created = await createUserRecord({
      name,
      email: email || null,
      pin,
      isAdmin: makeAdmin,
      createdBy: session.user.id,
    });
    await createWorkspace(created.id, workspaceName.slice(0, 40) || "Personal");
    await writeAudit(session.user.id, "user.create", created.id, {
      publicId: created.publicId,
      isAdmin: makeAdmin,
      workspace: workspaceName || "Personal",
    });
    refreshAdmin();
    return {
      ok: true,
      publicId: created.publicId,
      pin,
      message: requestedPin ? "Account created." : "Account created with a generated PIN.",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create the account." };
  }
}

export async function setUserStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const nextStatus = formData.get("status") === "suspended" ? "suspended" : "active";

  if (!userId) return { error: "Missing user." };
  if (userId === session.user.id && nextStatus === "suspended") {
    return { error: "You can't suspend your own account." };
  }

  await setUserStatus(userId, nextStatus);
  await writeAudit(
    session.user.id,
    `user.${nextStatus === "suspended" ? "suspend" : "activate"}`,
    userId,
    {},
  );
  refreshAdmin();
  return {
    ok: true,
    message: nextStatus === "suspended" ? "Account suspended." : "Account activated.",
  };
}

export async function setUserAdminAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const makeAdmin = formData.get("isAdmin") === "true";

  if (!userId) return { error: "Missing user." };
  if (!makeAdmin) {
    if (userId === session.user.id) return { error: "You can't remove your own admin access." };
    if ((await countAdmins()) <= 1) return { error: "There must be at least one admin." };
  }

  await setUserAdmin(userId, makeAdmin);
  await writeAudit(session.user.id, makeAdmin ? "user.grant_admin" : "user.revoke_admin", userId, {});
  refreshAdmin();
  return { ok: true, message: makeAdmin ? "Admin access granted." : "Admin access removed." };
}

export async function resetPinAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const publicId = String(formData.get("publicId") ?? "");
  if (!userId) return { error: "Missing user." };

  const pin = randomPin();
  await setUserPin(userId, pin);
  await writeAudit(session.user.id, "user.reset_pin", userId, { publicId });
  refreshAdmin();
  return {
    ok: true,
    pin,
    publicId,
    message: "New PIN generated. Share it once, then have them change it.",
  };
}

export async function deleteUserAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const publicId = String(formData.get("publicId") ?? "");

  if (!userId) return { error: "Missing user." };
  if (userId === session.user.id) return { error: "Delete your own account from Settings, not here." };

  const { rows } = await query<{ is_admin: boolean }>(
    "SELECT is_admin FROM users WHERE id = $1",
    [userId],
  );
  if (rows[0]?.is_admin && (await countAdmins()) <= 1) {
    return { error: "There must be at least one admin." };
  }

  await deleteUser(userId);
  await writeAudit(session.user.id, "user.delete", null, { publicId });
  refreshAdmin();
  return { ok: true, message: `Deleted user ${publicId}.` };
}

export async function deleteWorkspaceAction(formData: FormData) {
  const session = await requireAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const name = String(formData.get("name") ?? "");
  if (!workspaceId) redirect("/admin/workspaces");

  await query("DELETE FROM workspaces WHERE id = $1", [workspaceId]);
  await writeAudit(session.user.id, "workspace.delete", null, { workspaceId, name });
  refreshAdmin();
  redirect("/admin/workspaces");
}
