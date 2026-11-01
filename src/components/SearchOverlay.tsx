"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "./Sheet";

export type SearchHit = {
  id: string;
  content: string;
  type: string;
  is_completed: boolean;
  day: string | null;
  note_id: string | null;
  note_title: string | null;
};

/** Search belongs to the view, not to a page of its own (UX-23). */
export function SearchOverlay({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (hit: SearchHit) => void;
}) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setTerm("");
    setHits([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setBusy(false);
      return;
    }

    setBusy(true);
    const timer = window.setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => ({ hits: [] }))) as { hits?: SearchHit[] };
        setHits(body.hits ?? []);
      } catch {
        // An aborted request is a superseded one, not a failure.
      } finally {
        setBusy(false);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [open, term]);

  return (
    <Sheet open={open} title="Search" onClose={onClose}>
      <input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search every Thing…"
        aria-label="Search"
        className="ds-input"
        autoFocus
        autoComplete="off"
        enterKeyHint="search"
      />

      {busy && <p className="mt-3 text-xs text-muted">Looking…</p>}

      {!busy && term.trim().length >= 2 && hits.length === 0 && (
        <p className="mt-3 text-sm text-muted">No matches for “{term.trim()}”.</p>
      )}

      {hits.length > 0 && (
        <ul className="mt-2 divide-y divide-edge">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => onPick(hit)}
                className="flex w-full flex-col items-start gap-0.5 py-2.5 text-left"
              >
                <span
                  className={`text-sm ${hit.is_completed ? "text-muted line-through" : "text-ink"}`}
                >
                  {hit.content}
                </span>
                <span className="text-[11px] text-muted">
                  {hit.note_title ? `${hit.note_title} · ` : ""}
                  {hit.day ?? "Backlog"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
