"use client";

import { useEffect } from "react";

/**
 * The one panel shape in the app. Search, the backlog and the scratchpad open
 * here rather than as routes, so nothing about the day gets torn down to look
 * at something else (UX-23). A bottom sheet on a phone, a dialog once there is
 * room for one.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl border border-edge bg-canvas shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-edge px-4 py-2.5">
          <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          {children}
        </div>
      </div>
    </div>
  );
}
