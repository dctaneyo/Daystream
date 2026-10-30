"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  ACTIVE_WORKSPACE_COOKIE,
  createWorkspace,
  requireMembership,
} from "@/lib/workspaces";

export async function switchWorkspaceAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const workspaceId = String(formData.get("workspaceId") ?? "");
  const workspace = await requireMembership(userId, workspaceId);
  if (!workspace) redirect("/app");

  const store = await cookies();
  store.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/app");
}

export async function createWorkspaceAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  if (!name) redirect("/app");

  const workspace = await createWorkspace(userId, name);

  const store = await cookies();
  store.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/app");
}
