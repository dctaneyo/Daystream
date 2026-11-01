"use client";

import { useCallback, useEffect, useState } from "react";
import { NoteSurface } from "./NoteSurface";
import { MonthSheet } from "./MonthSheet";
import { SearchOverlay, type SearchHit } from "./SearchOverlay";
import { Sheet } from "./Sheet";
import { StatusPill, type ConnectionStatus } from "./StatusPill";
import { Scratchpad } from "./Scratchpad";
import { addDays, formatLongDate, todayISO } from "@/lib/date";
import { backlogRoom } from "@/lib/rooms";
import { showToast } from "@/lib/toast";
import type { DayNote } from "@/lib/day-view";

type BacklogTab = "things" | "scratchpad";

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px]" fill="none">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px]" fill="none">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m15.5 15.5 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px]" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The app's only view: one day, its Notes, and the Things typed straight into
 * them. Day changes, search, the month and the backlog all happen here — no
 * route change ever takes the page away (UX-23).
 */
export function DayHome({
  initialDay,
  initialNotes,
  workspaceId,
  user,
  initialSheet = null,
}: {
  initialDay: string;
  initialNotes: DayNote[];
  workspaceId: string;
  user: { id: string; name: string };
  initialSheet?: "backlog" | null;
}) {
  const today = todayISO();
  const [day, setDay] = useState(initialDay);
  const [notes, setNotes] = useState<DayNote[]>(initialNotes);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [backlogOpen, setBacklogOpen] = useState(initialSheet === "backlog");
  const [backlogTab, setBacklogTab] = useState<BacklogTab>("things");
  const [backlogNote, setBacklogNote] = useState<DayNote | null>(null);
  const [backlogLoading, setBacklogLoading] = useState(false);
  const [backlogError, setBacklogError] = useState<string | null>(null);
  const [backlogAttempt, setBacklogAttempt] = useState(0);
  const [monthOpen, setMonthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);

  const loadDay = useCallback(async (next: string) => {
    setDay(next);
    window.history.replaceState(null, "", next === todayISO() ? "/app" : `/app?d=${next}`);
    try {
      const response = await fetch(`/api/day?d=${next}`);
      if (!response.ok) throw new Error();
      const body = (await response.json()) as { notes?: DayNote[] };
      setNotes(body.notes ?? []);
    } catch {
      showToast({ message: "Couldn't load that day.", tone: "error" });
    }
  }, []);

  // The chrome dispatches; the view owns the state. Nothing navigates.
  useEffect(() => {
    const openSearch = () => setSearchOpen(true);
    const openBacklog = () => {
      setBacklogTab("things");
      setBacklogOpen(true);
    };
    window.addEventListener("daystream:search", openSearch);
    window.addEventListener("daystream:backlog", openBacklog);
    return () => {
      window.removeEventListener("daystream:search", openSearch);
      window.removeEventListener("daystream:backlog", openBacklog);
    };
  }, []);

  // The backlog resolves server-side, so a missing id can never strand the sheet.
  useEffect(() => {
    if (!backlogOpen || backlogTab !== "things" || backlogNote) return;
    let cancelled = false;
    setBacklogLoading(true);
    setBacklogError(null);
    void (async () => {
      try {
        const response = await fetch("/api/backlog");
        if (!response.ok) throw new Error();
        const body = (await response.json()) as DayNote;
        if (!cancelled) setBacklogNote(body);
      } catch {
        if (!cancelled) setBacklogError("Couldn't open the backlog.");
      } finally {
        if (!cancelled) setBacklogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backlogAttempt, backlogNote, backlogOpen, backlogTab]);

  /** A Note is made by a control, not by filling in a form at the bottom. */
  const createNote = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day }),
      });
      const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || !body.id) throw new Error(body.error ?? "Could not create that Note.");
      const id = body.id;
      setNotes((current) => [
        ...current,
        {
          id,
          title: "Untitled note",
          thingCount: 0,
          memberCount: 0,
          isInbox: false,
          canManage: true,
          sharedWithMe: false,
          members: [],
        },
      ]);
      setFocusNoteId(id);
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Could not create that Note.",
        tone: "error",
      });
    } finally {
      setCreating(false);
    }
  }, [creating, day]);

  const pickHit = useCallback(
    (hit: SearchHit) => {
      setSearchOpen(false);
      if (hit.day && hit.day !== day) void loadDay(hit.day);
    },
    [day, loadDay],
  );

  const pickDay = useCallback(
    (next: string) => {
      setMonthOpen(false);
      if (next !== day) void loadDay(next);
    },
    [day, loadDay],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-edge bg-canvas/85 px-4 pb-2 pt-2.5 backdrop-blur sm:px-6">
        <div className="flex items-center gap-1">
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-ink">
            {formatLongDate(day)}
          </h1>
          <StatusPill status={status} peers={[]} />
          <button
            type="button"
            onClick={() => setMonthOpen(true)}
            aria-label="Choose a day"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-raised hover:text-ink"
          >
            <CalendarIcon />
          </button>
          <button
            type="button"
            onClick={() => void createNote()}
            disabled={creating}
            aria-label="New Note"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-raised hover:text-ink disabled:opacity-40"
          >
            <PlusIcon />
          </button>
        </div>

        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
          <button
            type="button"
            onClick={() => void loadDay(addDays(day, -1))}
            aria-label="Previous day"
            className="grid h-10 w-8 place-items-center rounded-lg text-base hover:bg-raised hover:text-ink"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => void loadDay(today)}
            aria-disabled={day === today}
            className={`grid h-10 place-items-center rounded-lg px-2 hover:bg-raised hover:text-ink ${
              day === today ? "text-ink opacity-50" : ""
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => void loadDay(addDays(day, 1))}
            aria-label="Next day"
            className="grid h-10 w-8 place-items-center rounded-lg text-base hover:bg-raised hover:text-ink"
          >
            ›
          </button>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="ml-auto grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink sm:hidden"
          >
            <SearchIcon />
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="ml-auto hidden min-h-10 w-64 items-center gap-2 rounded-lg border border-edge px-3 text-left text-[13px] text-muted transition hover:border-accent/40 hover:text-ink sm:flex"
          >
            <SearchIcon />
            Search notes and Things
          </button>
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
              Nothing here yet. Tap the plus to start a Note, then type — every line you write in it
              becomes a Thing.
            </p>
          )}
        </div>
      </main>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onPick={pickHit} />

      <MonthSheet
        open={monthOpen}
        day={day}
        onClose={() => setMonthOpen(false)}
        onPick={pickDay}
      />

      <Sheet open={backlogOpen} title="Backlog" onClose={() => setBacklogOpen(false)}>
        <div className="mb-3 flex gap-1 rounded-lg bg-raised p-1">
          {(["things", "scratchpad"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setBacklogTab(tab)}
              aria-pressed={backlogTab === tab}
              className={`min-h-9 flex-1 rounded-md px-2 text-xs transition ${
                backlogTab === tab ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {tab === "things" ? "Things" : "Scratchpad"}
            </button>
          ))}
        </div>

        {backlogTab === "things" ? (
          backlogNote ? (
            <>
              <p className="mb-3 text-xs leading-relaxed text-muted">Things with no day yet.</p>
              <NoteSurface
                note={backlogNote}
                user={user}
                showTitle={false}
                onStatus={setStatus}
                onDeleted={() => {
                  setBacklogNote(null);
                  setBacklogOpen(false);
                }}
              />
            </>
          ) : backlogError ? (
            <div className="flex flex-col items-start gap-2 py-6">
              <p className="text-sm text-muted">{backlogError}</p>
              <button
                type="button"
                onClick={() => {
                  setBacklogError(null);
                  setBacklogAttempt((attempt) => attempt + 1);
                }}
                className="min-h-10 rounded-lg border border-edge px-3 text-xs text-ink hover:border-accent/40"
              >
                Try again
              </button>
            </div>
          ) : (
            <p className="py-4 text-sm text-muted">
              {backlogLoading ? "Opening your backlog…" : ""}
            </p>
          )
        ) : (
          <Scratchpad room={backlogRoom(workspaceId)} userId={user.id} />
        )}
      </Sheet>
    </div>
  );
}
