"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { NoteSurface } from "./NoteSurface";
import { SearchOverlay, type SearchHit } from "./SearchOverlay";
import { Sheet } from "./Sheet";
import { StatusPill, type ConnectionStatus } from "./StatusPill";
import { Scratchpad } from "./Scratchpad";
import { addDays, formatLongDate, todayISO } from "@/lib/date";
import { backlogRoom } from "@/lib/rooms";
import { showToast } from "@/lib/toast";
import type { DayNote } from "@/lib/day-view";

type SheetName = "inbox" | "scratchpad" | null;

/**
 * The app's only view: one day, its Notes, and the Things typed straight into
 * them. Day changes, search and the backlog all happen here — no route change
 * ever takes the page away (UX-23).
 */
export function DayHome({
  initialDay,
  initialNotes,
  initialInboxId,
  workspaceId,
  user,
  initialSheet = null,
}: {
  initialDay: string;
  initialNotes: DayNote[];
  initialInboxId: string | null;
  workspaceId: string;
  user: { id: string; name: string };
  initialSheet?: SheetName;
}) {
  const today = todayISO();
  const [day, setDay] = useState(initialDay);
  const [notes, setNotes] = useState<DayNote[]>(initialNotes);
  const [inboxId, setInboxId] = useState<string | null>(initialInboxId);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [sheet, setSheet] = useState<SheetName>(initialSheet);
  const [inboxNote, setInboxNote] = useState<DayNote | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);

  const loadDay = useCallback(async (next: string) => {
    setDay(next);
    window.history.replaceState(null, "", next === todayISO() ? "/app" : `/app?d=${next}`);
    try {
      const response = await fetch(`/api/day?d=${next}`);
      if (!response.ok) throw new Error();
      const body = (await response.json()) as { notes?: DayNote[]; inboxId?: string | null };
      setNotes(body.notes ?? []);
      setInboxId(body.inboxId ?? null);
    } catch {
      showToast({ message: "Couldn't load that day.", tone: "error" });
    }
  }, []);

  // The bottom bar's Search is a control for this view, not a destination.
  useEffect(() => {
    const open = () => setSearchOpen(true);
    window.addEventListener("daystream:search", open);
    return () => window.removeEventListener("daystream:search", open);
  }, []);

  useEffect(() => {
    if (sheet !== "inbox" || !inboxId || inboxNote?.id === inboxId) return;
    void (async () => {
      try {
        const response = await fetch(`/api/notes/${inboxId}`);
        if (!response.ok) throw new Error();
        const body = (await response.json()) as DayNote;
        setInboxNote(body);
      } catch {
        showToast({ message: "Couldn't open the backlog.", tone: "error" });
      }
    })();
  }, [inboxId, inboxNote?.id, sheet]);

  const createNote = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const title = newTitle.trim();
      if (!title || creating) return;
      setCreating(true);
      try {
        const response = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, day }),
        });
        const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!response.ok || !body.id) throw new Error(body.error ?? "Could not create that Note.");
        setNewTitle("");
        setNotes((current) => [
          ...current,
          {
            id: body.id as string,
            title,
            thingCount: 0,
            memberCount: 0,
            isInbox: false,
            canManage: true,
            sharedWithMe: false,
            members: [],
          },
        ]);
        setFocusNoteId(body.id as string);
      } catch (error) {
        showToast({
          message: error instanceof Error ? error.message : "Could not create that Note.",
          tone: "error",
        });
      } finally {
        setCreating(false);
      }
    },
    [creating, day, newTitle],
  );

  const pickHit = useCallback(
    (hit: SearchHit) => {
      setSearchOpen(false);
      if (hit.day && hit.day !== day) void loadDay(hit.day);
    },
    [day, loadDay],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-edge bg-canvas/85 px-4 pb-2.5 pt-3 backdrop-blur sm:px-6">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{day}</p>
            <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
              {formatLongDate(day)}
            </h1>
          </div>
          <StatusPill status={status} peers={[]} />
        </div>

        <div className="mt-1 flex items-center gap-1 text-xs text-muted">
          <button
            type="button"
            onClick={() => void loadDay(addDays(day, -1))}
            aria-label="Previous day"
            className="grid h-10 w-10 place-items-center rounded-lg hover:bg-raised hover:text-ink"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => void loadDay(today)}
            className={`grid h-10 place-items-center rounded-lg px-2 hover:bg-raised hover:text-ink ${
              day === today ? "text-ink" : ""
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => void loadDay(addDays(day, 1))}
            aria-label="Next day"
            className="grid h-10 w-10 place-items-center rounded-lg hover:bg-raised hover:text-ink"
          >
            ›
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="grid h-10 place-items-center rounded-lg px-2.5 hover:bg-raised hover:text-ink"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setSheet("inbox")}
              className="grid h-10 place-items-center rounded-lg px-2.5 hover:bg-raised hover:text-ink"
            >
              Backlog
            </button>
            <button
              type="button"
              onClick={() => setSheet("scratchpad")}
              aria-label="Scratchpad"
              className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
            >
              ✎
            </button>
          </div>
        </div>
      </header>

      <main className="ds-scroll flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5 sm:px-6">
          <div data-day-notes="true" className="flex flex-col gap-9">
            {notes.map((note) => (
              <NoteSurface
                key={note.id}
                note={note}
                user={user}
                autoFocus={focusNoteId === note.id}
                onStatus={setStatus}
                onDeleted={(noteId) =>
                  setNotes((current) => current.filter((entry) => entry.id !== noteId))
                }
              />
            ))}
          </div>

          {notes.length === 0 && (
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Nothing written today. A Note is the home for the Things you add — name one and start
              typing.
            </p>
          )}

          <form onSubmit={createNote} className="mt-10 flex gap-2 border-t border-edge pt-4">
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="New Note for this day"
              aria-label="New Note"
              maxLength={120}
              autoComplete="off"
              enterKeyHint="done"
              className="ds-input"
            />
            <button
              type="submit"
              disabled={!newTitle.trim() || creating}
              className="ds-button ds-button-primary min-h-11 shrink-0 px-4 text-xs disabled:opacity-40"
            >
              Create
            </button>
          </form>
        </div>
      </main>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onPick={pickHit} />

      <Sheet open={sheet === "inbox"} title="Backlog" onClose={() => setSheet(null)}>
        {inboxNote ? (
          <>
            <p className="mb-3 text-xs leading-relaxed text-muted">
              Things with no day yet. Everything here lives in your Inbox.
            </p>
            <NoteSurface
              note={inboxNote}
              user={user}
              onStatus={setStatus}
              onDeleted={() => {
                setInboxNote(null);
                setInboxId(null);
                setSheet(null);
              }}
            />
          </>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </Sheet>

      <Sheet open={sheet === "scratchpad"} title="Scratchpad" onClose={() => setSheet(null)}>
        <Scratchpad room={backlogRoom(workspaceId)} userId={user.id} />
      </Sheet>
    </div>
  );
}
