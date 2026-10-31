"use client";

import { useActionState } from "react";
import {
  deleteNoteAction,
  renameNoteAction,
  shareNoteAction,
  unshareNoteAction,
} from "@/actions/notes";
import type { ActionState } from "@/lib/action-types";

export type ShareMember = { userId: string; publicId: string; name: string };

export function NoteSharePanel({
  noteId,
  title,
  members,
  canManage,
  sharedWithMe,
}: {
  noteId: string;
  title: string;
  members: ShareMember[];
  canManage: boolean;
  sharedWithMe: boolean;
}) {
  const [shareState, shareAction, sharePending] = useActionState<ActionState, FormData>(
    shareNoteAction,
    { error: null },
  );
  const [renameState, renameAction, renamePending] = useActionState<ActionState, FormData>(
    renameNoteAction,
    { error: null },
  );

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted">People</h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          <li className="flex items-center justify-between rounded-lg border border-edge bg-panel px-3 py-2">
            <span className="text-ink">You</span>
            <span className="text-[11px] text-muted">{canManage ? "owner" : "guest"}</span>
          </li>
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center gap-2 rounded-lg border border-edge bg-panel px-3 py-2"
            >
              <span className="font-mono text-xs text-muted">{member.publicId}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{member.name}</span>
              {canManage && (
                <form action={unshareNoteAction}>
                  <input type="hidden" name="noteId" value={noteId} />
                  <input type="hidden" name="memberId" value={member.userId} />
                  <button type="submit" className="text-[11px] text-muted hover:text-ink">
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {canManage ? (
          <form action={shareAction} className="mt-2 flex gap-2">
            <input type="hidden" name="noteId" value={noteId} />
            <input
              name="publicId"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="Their 6-digit ID"
              className="ds-input"
              aria-label="Share with Daystream ID"
            />
            <button
              type="submit"
              disabled={sharePending}
              className="ds-button shrink-0 px-3 disabled:opacity-40"
            >
              {sharePending ? "Adding…" : "Share"}
            </button>
          </form>
        ) : (
          <p className="mt-2 text-[11px] text-muted">Only the owner can add or remove people.</p>
        )}

        {shareState.error && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-300">{shareState.error}</p>
        )}
        {shareState.message && <p className="mt-2 text-xs text-muted">{shareState.message}</p>}
        {sharedWithMe && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Shared with you. Everyone in this list edits the note live — you will see their caret.
          </p>
        )}
      </section>

      {canManage && (
        <section className="border-t border-edge pt-4">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted">Name</h2>
          <form action={renameAction} className="mt-2 flex gap-2">
            <input type="hidden" name="noteId" value={noteId} />
            <input
              name="title"
              defaultValue={title}
              maxLength={120}
              className="ds-input"
              aria-label="Note title"
            />
            <button
              type="submit"
              disabled={renamePending}
              className="ds-button shrink-0 px-3 disabled:opacity-40"
            >
              Save
            </button>
          </form>
          {renameState.error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-300">{renameState.error}</p>
          )}
        </section>
      )}

      {canManage && (
        <section className="border-t border-edge pt-4">
          <form
            action={deleteNoteAction}
            onSubmit={(event) => {
              if (!window.confirm(`Delete “${title}”? Every Thing in it goes too.`)) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="noteId" value={noteId} />
            <button
              type="submit"
              className="text-xs text-red-600 hover:underline dark:text-red-300"
            >
              Delete note
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
