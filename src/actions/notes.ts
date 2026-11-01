"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveActiveWorkspace } from "@/lib/workspaces";
import type { ActionState } from "@/lib/action-types";
import {
  addNoteMember,
  canManageNote,
  createNote,
  deleteNote,
  getNoteForUser,
  removeNoteMember,
  renameNote,
} from "@/lib/notes";

async function requireUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  return { userId, session };
}

export async function createNoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();

  const workspace = await resolveActiveWorkspace(userId);
  try {
    const note = await createNote({
      userId,
      workspaceId: workspace.id,
      title: title || "Untitled note",
    });
    revalidatePath("/app");
    redirect("/app");
  } catch (error) {
    // `redirect` throws on purpose; let Next handle it.
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    return { error: error instanceof Error ? error.message : "Could not create the note." };
  }
}

/** Creates a Note inside a day and opens it, which is the only way in (UX-23). */
export async function createNoteForDayAction(formData: FormData) {
  const { userId } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const rawDay = String(formData.get("day") ?? "").trim();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(rawDay) ? rawDay : undefined;

  const workspace = await resolveActiveWorkspace(userId);
  const note = await createNote({
    userId,
    workspaceId: workspace.id,
    title: title || "Untitled note",
    day,
  });

  revalidatePath("/app");
  redirect(day ? `/app?d=${day}` : "/app");
}

export async function renameNoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await requireUser();
  const noteId = String(formData.get("noteId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!noteId) return { error: "Missing note." };
  if (!title) return { error: "Give the note a name." };

  const note = await getNoteForUser(noteId, userId);
  if (!note?.canManage) return { error: "Only the owner can rename this note." };

  await renameNote(noteId, userId, title);
  revalidatePath("/app");
  return { ok: true, message: "Renamed." };
}

export async function deleteNoteAction(formData: FormData) {
  const { userId } = await requireUser();
  const noteId = String(formData.get("noteId") ?? "");
  if (!noteId) redirect("/app");

  await deleteNote(noteId, userId);
  revalidatePath("/app");
  redirect("/app");
}

export async function shareNoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await requireUser();
  const noteId = String(formData.get("noteId") ?? "");
  const publicId = String(formData.get("publicId") ?? "").trim();

  if (!noteId) return { error: "Missing note." };
  if (!/^\d{6}$/.test(publicId)) return { error: "Enter the other person's 6-digit ID." };
  if (!(await canManageNote(noteId, userId))) {
    return { error: "Only the owner can share this note." };
  }

  const result = await addNoteMember(noteId, publicId);
  if (!result.ok) return { error: result.error };

  revalidatePath("/app");
  return { ok: true, message: `Shared with ${result.member.name} (${result.member.publicId}).` };
}

export async function unshareNoteAction(formData: FormData) {
  const { userId } = await requireUser();
  const noteId = String(formData.get("noteId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  if (!noteId || !memberId) return;
  if (!(await canManageNote(noteId, userId))) return;

  await removeNoteMember(noteId, memberId);
  revalidatePath("/app");
}
