"use client";

import { useActionState } from "react";
import { createUserAction } from "@/actions/admin";
import type { ActionState } from "@/lib/action-types";

export function CreateUserForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createUserAction, {
    error: null,
  });

  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <h2 className="text-sm font-medium">New account</h2>
      <p className="mt-1 text-xs text-muted">
        Leave the PIN blank to generate one. The ID is generated automatically.
      </p>

      <form action={action} className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <input name="name" placeholder="Full name" required minLength={2} className="ds-input" />
        <input name="email" type="email" placeholder="Email (optional)" className="ds-input" />
        <input
          name="pin"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          placeholder="6-digit PIN (optional)"
          className="ds-input"
        />
        <input name="workspace" placeholder="First workspace" defaultValue="Personal" className="ds-input" />
        <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2">
          <input type="checkbox" name="isAdmin" className="h-4 w-4 accent-[#7c8cff]" />
          Grant admin console access
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="ds-button ds-button-primary w-full py-2.5 disabled:opacity-40">
            {pending ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>

      {state.error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-300">{state.error}</p>
      )}

      {state.ok && state.publicId && (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3">
          <p className="text-xs text-emerald-700 dark:text-emerald-200">{state.message}</p>
          <p className="mt-2 font-mono text-sm text-ink">
            ID <strong className="tracking-[0.2em]">{state.publicId}</strong> · PIN{" "}
            <strong className="tracking-[0.2em]">{state.pin}</strong>
          </p>
          <p className="mt-1.5 text-[11px] text-emerald-700/80 dark:text-emerald-200/80">
            Share this once. It will not be shown again — reset the PIN if it is lost.
          </p>
        </div>
      )}
    </div>
  );
}
