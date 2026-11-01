"use client";

import { useEffect, useState } from "react";
import { dismissToast, subscribeToast, type ToastMessage } from "@/lib/toast";

/**
 * Sits above the composer and the mobile tab bar so an undo offer never covers
 * the line it is offering to restore.
 */
export function Toaster() {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => subscribeToast(setToast), []);

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-6">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-sm items-center gap-1 rounded-xl border border-edge bg-panel py-1 pl-3.5 pr-1 shadow-lg"
      >
        <span
          className={`min-w-0 flex-1 py-2 text-sm ${
            toast.tone === "error" ? "text-danger" : "text-ink"
          }`}
        >
          {toast.message}
        </span>

        {toast.action && (
          <button
            type="button"
            onClick={() => {
              const action = toast.action;
              dismissToast();
              action?.run();
            }}
            className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-medium text-accent"
          >
            {toast.action.label}
          </button>
        )}

        <button
          type="button"
          onClick={dismissToast}
          aria-label="Dismiss"
          className="grid h-11 w-9 shrink-0 place-items-center text-xs text-muted"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
