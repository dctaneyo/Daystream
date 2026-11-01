"use client";

import { useEffect, useState } from "react";

/**
 * The one decision capture asks: an existing Note, or a new one. Rows are 44px,
 * the current home is marked, and starting a Note lives in the same sheet so the
 * choice never becomes a detour (UX-33, UX-20).
 */
export function NotePicker({
  open,
  notes,
  selectedId,
  onSelect,
  onCreate,
  onClose,
}: {
  open: boolean;
  notes: Array<{ id: string; title: string }>;
  selectedId: string | null;
  onSelect: (note: { id: string; title: string }) => void;
  onCreate: (title: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!open) {
      setTitle("");
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:items-center sm:pb-3"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a Note"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-edge bg-panel shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="border-b border-edge px-4 py-3 text-[11px] uppercase tracking-wider text-muted">
          Add this Thing to
        </p>

        <ul className="max-h-[45vh] overflow-y-auto">
          {notes.map((note) => {
            const active = note.id === selectedId;
            return (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => onSelect(note)}
                  className={`flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm hover:bg-raised ${
                    active ? "text-accent" : "text-ink"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{note.title}</span>
                  {active && (
                    <span className="shrink-0 text-[11px] uppercase tracking-wide text-accent">
                      here
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {notes.length === 0 && (
            <li className="px-4 py-4 text-sm text-muted">No Notes yet. Name the first one below.</li>
          )}
        </ul>

        <form
          className="flex gap-2 border-t border-edge p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const next = title.trim();
            if (!next) return;
            void onCreate(next);
          }}
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="New Note…"
            aria-label="New Note title"
            maxLength={120}
            className="ds-input"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="ds-button ds-button-primary shrink-0 px-3 text-xs disabled:opacity-40"
          >
            Create
          </button>
        </form>
      </div>
    </div>
  );
}
