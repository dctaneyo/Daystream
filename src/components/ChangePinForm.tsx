"use client";

import { useActionState } from "react";
import { changePinAction } from "@/actions/auth";
import type { ActionState } from "@/lib/action-types";

export function ChangePinForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(changePinAction, {
    error: null,
  });

  return (
    <form action={action} className="mt-3 grid gap-2.5 sm:grid-cols-3">
      <input
        name="current"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        placeholder="Current PIN"
        aria-label="Current PIN"
        required
        className="ds-input"
      />
      <input
        name="next"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        placeholder="New PIN"
        aria-label="New PIN"
        required
        className="ds-input"
      />
      <input
        name="confirm"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        placeholder="Confirm new PIN"
        aria-label="Confirm new PIN"
        required
        className="ds-input"
      />
      <div className="sm:col-span-3">
        <button type="submit" disabled={pending} className="ds-button px-4 py-2 disabled:opacity-40">
          {pending ? "Saving…" : "Update PIN"}
        </button>
      </div>
      {state.error && (
        <p className="text-xs text-red-600 sm:col-span-3 dark:text-red-300">{state.error}</p>
      )}
      {state.ok && (
        <p className="text-xs text-emerald-600 sm:col-span-3 dark:text-emerald-300">
          {state.message}
        </p>
      )}
    </form>
  );
}
