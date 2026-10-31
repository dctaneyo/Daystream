"use client";

import { useActionState } from "react";
import { createNoteAction } from "@/actions/notes";
import type { ActionState } from "@/lib/action-types";

export function NoteComposer() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createNoteAction, {
    error: null,
  });

  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <form action={action} className="flex gap-2">
        <input
          name="title"
          placeholder="New note — e.g. Launch ideas"
          maxLength={120}
          required
          className="ds-input"
          aria-label="Note title"
        />
        <button
          type="submit"
          disabled={pending}
          className="ds-button ds-button-primary shrink-0 px-4 disabled:opacity-40"
        >
          {pending ? "Creating…" : "Create"}
        </button>
      </form>
      {state.error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{state.error}</p>}
    </div>
  );
}
