import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import { api } from "../lib/api";
import { openPresenceSession, type PresenceSession } from "../lib/collab";
import { addDays, isToday, longDate, readDateParam, relativeDay, todayKey } from "../lib/dates";
import { authMessage } from "../lib/errors";
import { awarenessUser } from "../lib/presence";
import { useSession } from "../lib/session";
import { useDay } from "../lib/useDay";
import type { AwarenessUser, NoteSummary, Template } from "../types";
import { DateRail } from "./DateRail";
import { NoteEditor } from "./NoteEditor";
import {
  CalendarSheet,
  SettingsSheet,
  TemplatesSheet,
  WorkspaceSheet,
} from "./Sheets";

const WORKSPACE_KEY = "daystream.workspace";

export function DayShell() {
  const session = useSession();
  const me = session.me;

  const [workspaceId, setWorkspaceId] = useState(() => {
    try {
      const stored = localStorage.getItem(WORKSPACE_KEY);
      if (stored) return stored;
    } catch {
      /* ignore */
    }
    return me?.workspaces[0]?.id ?? "";
  });
  const [date, setDate] = useState(() => readDateParam(window.location.search) ?? todayKey());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [footprints, setFootprints] = useState<Record<string, AwarenessUser[]>>({});
  const [presence, setPresence] = useState<PresenceSession | null>(null);

  const from = addDays(date, -7);
  const to = addDays(date, 14);
  const { data, loading, error, reload } = useDay(workspaceId || null, date, from, to);

  const activity = useMemo(() => {
    const map = new Map<string, number>();
    data?.activity.forEach((entry) => map.set(entry.date, entry.count));
    return map;
  }, [data]);

  const notes = data?.day.notes ?? [];
  const pinned = data?.pinned ?? [];
  const shared = useMemo(
    () => (data?.shared ?? []).map((note) => ({ ...note, access: "shared" as const })),
    [data],
  );

  const openNote = useMemo(() => {
    if (!openNoteId) return null;
    return [...notes, ...pinned, ...shared].find((note) => note.id === openNoteId) ?? null;
  }, [openNoteId, notes, pinned, shared]);

  const chooseWorkspace = useCallback((id: string) => {
    setWorkspaceId(id);
    try {
      localStorage.setItem(WORKSPACE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (data?.workspace && data.workspace.id !== workspaceId) {
      chooseWorkspace(data.workspace.id);
    }
  }, [data, workspaceId, chooseWorkspace]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("d", date);
    window.history.replaceState(null, "", url);
  }, [date]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Layer 1 presence: one awareness socket per workspace, independent of which
  // note is open, so dots appear on dates nobody has opened yet.
  useEffect(() => {
    if (!workspaceId || !me) return;
    let cancelled = false;
    let opened: PresenceSession | null = null;
    let detach: (() => void) | null = null;

    openPresenceSession(
      workspaceId,
      awarenessUser(me.user.userId, me.user.displayName),
    )
      .then((next) => {
        if (cancelled) {
          next.destroy();
          return;
        }
        opened = next;
        const awareness = next.provider.awareness;
        const sync = () => {
          const collected: Record<string, AwarenessUser[]> = {};
          awareness?.getStates().forEach((state, clientId) => {
            if (clientId === awareness.clientID) return;
            const user = state.user as AwarenessUser | undefined;
            const footprint = state.footprint as { date?: string } | undefined;
            if (!user || !footprint?.date) return;
            (collected[footprint.date] ??= []).push(user);
          });
          setFootprints(collected);
        };
        awareness?.on("change", sync);
        sync();
        detach = () => awareness?.off("change", sync);
        setPresence(next);
      })
      .catch(() => {
        /* presence is decorative; writing must not depend on it */
      });

    return () => {
      cancelled = true;
      detach?.();
      opened?.destroy();
      setPresence(null);
    };
  }, [workspaceId, me]);

  useEffect(() => {
    presence?.update({ date, noteId: openNote?.id ?? null });
  }, [presence, date, openNote?.id]);

  const go = useCallback((delta: number) => {
    setDate((current) => addDays(current, delta));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (openNoteId) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "ArrowRight") go(1);
      else if (event.key.toLowerCase() === "t") setDate(todayKey());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, openNoteId]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 72 && Math.abs(dy) < 44) go(dx < 0 ? 1 : -1);
  };

  const createNote = async (template?: Template) => {
    if (!workspaceId) return;
    setMutating(true);
    setActionError("");
    try {
      const note = await api<NoteSummary>("/notes", {
        method: "POST",
        json: {
          assignedDate: date,
          workspaceId,
          templateId: template?.id,
        },
      });
      setTemplatesOpen(false);
      await reload(true);
      setOpenNoteId(note.id);
    } catch (caught) {
      setActionError(authMessage(caught));
    } finally {
      setMutating(false);
    }
  };

  const closeEditor = useCallback(() => {
    setOpenNoteId(null);
    void reload(true);
  }, [reload]);

  const retry = () => {
    void reload();
  };

  return (
    <div className="ds-shell">
      <header className="ds-header">
        <span className="ds-wordmark">DAYSTREAM</span>
        <div className="ds-header-right">
          <button
            type="button"
            className="ds-workspace-btn"
            aria-label={`Workspace: ${data?.workspace.name ?? "loading"}`}
            onClick={() => setWorkspaceOpen(true)}
          >
            {data?.workspace.name ?? "Workspace"}
          </button>
          <span className={`ds-conn ${online ? "is-live" : ""}`}>
            {online ? "Live" : "Local"}
          </span>
          <button
            type="button"
            className="ds-text-btn"
            onClick={() => setSettingsOpen(true)}
          >
            Account
          </button>
        </div>
      </header>

      {shared.length > 0 ? (
        <section className="ds-tray ds-tray--shared" aria-label="Shared with you">
          <div className="ds-tray-head">
            <span className="ds-eyebrow">Shared with you</span>
            <span className="ds-tray-count">{shared.length}</span>
          </div>
          <div className="ds-tray-scroll">
            {shared.map((note) => (
              <button
                key={note.id}
                type="button"
                className="ds-tray-item ds-shared-item"
                onClick={() => setOpenNoteId(note.id)}
              >
                <span className="ds-shared-workspace">{note.workspaceName}</span>
                <span className="ds-tray-title">{note.title || "Untitled"}</span>
                <span className="ds-tray-excerpt">{note.excerpt || "Empty note"}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {pinned.length > 0 ? (
        <section className="ds-tray" aria-label="Held notes">
          <div className="ds-tray-head">
            <span className="ds-eyebrow">Held</span>
            <span className="ds-tray-count">{pinned.length}</span>
          </div>
          <div className="ds-tray-scroll">
            {pinned.map((note) => (
              <button
                key={note.id}
                type="button"
                className="ds-tray-item"
                onClick={() => setOpenNoteId(note.id)}
              >
                <span className="ds-tray-title">{note.title || "Untitled"}</span>
                <span className="ds-tray-excerpt">{note.excerpt || "Empty note"}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <DateRail
        date={date}
        onSelect={setDate}
        activity={activity}
        footprints={footprints}
      />

      <main className="ds-day" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="ds-day-head">
          <div className="ds-day-heading">
            <span className="ds-eyebrow">{relativeDay(date)}</span>
            <h1 className="ds-day-title">{longDate(date)}</h1>
          </div>
          <div className="ds-day-head-right">
            <button
              type="button"
              className="ds-text-btn"
              onClick={() => setCalendarOpen(true)}
            >
              Calendar
            </button>
            {!isToday(date) ? (
              <button
                type="button"
                className="ds-text-btn"
                onClick={() => setDate(todayKey())}
              >
                Today
              </button>
            ) : null}
          </div>
        </div>

        {error && !data ? (
          <div className="ds-empty">
            <p className="ds-empty-line">{error}</p>
            <button type="button" className="ds-text-btn" onClick={retry}>
              Try again
            </button>
          </div>
        ) : (
          <div className="ds-stack" aria-busy={loading || mutating}>
            {notes.map((note) => (
              <button
                key={note.id}
                type="button"
                className={`ds-note-row ${note.pinMode === "day" ? "is-day-pinned" : ""} ${
                  note.excerpt ? "" : "is-empty"
                }`}
                onClick={() => setOpenNoteId(note.id)}
              >
                {note.pinMode === "day" ? (
                  <span className="ds-note-meta">
                    <span className="ds-note-mark">First today</span>
                  </span>
                ) : null}
                <span className="ds-note-title">{note.title || "Untitled"}</span>
                <span className="ds-note-excerpt">
                  {note.excerpt || "A page with nothing on it yet."}
                </span>
              </button>
            ))}

            {!loading && notes.length === 0 ? (
              <div className="ds-empty">
                <p className="ds-empty-line">Nothing written for this day.</p>
                <button
                  type="button"
                  className="ds-text-btn"
                  onClick={() => void createNote()}
                  disabled={mutating}
                >
                  Start a note
                </button>
              </div>
            ) : null}
          </div>
        )}

        <div className="ds-day-actions">
          <button
            type="button"
            className="ds-new-note"
            onClick={() => void createNote()}
            disabled={mutating}
          >
            New note
          </button>
          <button
            type="button"
            className="ds-text-btn"
            onClick={() => setTemplatesOpen(true)}
            disabled={mutating}
          >
            From a template
          </button>
        </div>

        {actionError ? (
          <p className="ds-inline-note" role="alert">
            {actionError}
          </p>
        ) : null}
      </main>

      {settingsOpen ? (
        <SettingsSheet onClose={() => setSettingsOpen(false)} />
      ) : null}

      {workspaceOpen ? (
        <WorkspaceSheet
          workspace={data?.workspace ?? null}
          workspaces={data?.workspaces ?? me?.workspaces ?? []}
          members={data?.members ?? []}
          activeWorkspaceId={workspaceId}
          onClose={() => setWorkspaceOpen(false)}
          onWorkspaceChange={(id) => {
            chooseWorkspace(id);
            setWorkspaceOpen(false);
          }}
          onChanged={() => void reload(true)}
        />
      ) : null}

      {calendarOpen ? (
        <CalendarSheet
          date={date}
          onPick={setDate}
          onClose={() => setCalendarOpen(false)}
        />
      ) : null}

      {templatesOpen ? (
        <TemplatesSheet
          templates={data?.templates ?? []}
          busy={mutating}
          onPick={(template) => void createNote(template)}
          onClose={() => setTemplatesOpen(false)}
        />
      ) : null}

      {openNote ? (
        <NoteEditor
          note={openNote}
          canManage={openNote.access !== "shared"}
          onClose={closeEditor}
          onChanged={() => void reload(true)}
        />
      ) : null}
    </div>
  );
}
