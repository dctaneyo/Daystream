"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { HocuspocusProvider } from "@hocuspocus/provider";
import {
  BLOCKS_KEY,
  createBlockMap,
  newBlockId,
  readBlocks,
  type Block,
  type BlockType,
} from "@/lib/blocks";
import { colorForUser } from "@/lib/colors";
import { addDays, todayISO } from "@/lib/date";
import { backlogRoom, dayRoom, noteRoom } from "@/lib/rooms";
import { BlockItem } from "@/components/BlockItem";
import { FormatBar } from "@/components/FormatBar";
import { StatusPill, type ConnectionStatus } from "@/components/StatusPill";
import { splitTaskPrefix } from "@/lib/format-text";
import type { CursorMap, Peer } from "@/lib/presence";
import { collabUrl, fetchCollabToken } from "@/lib/collab-client";
import { rememberStatus, sharedStatus } from "@/lib/collab-status";
import { showToast } from "@/lib/toast";

export function DailyCanvas({
  workspaceId,
  workspaceName,
  room,
  mode,
  date,
  title,
  notes,
  user,
}: {
  workspaceId: string;
  workspaceName: string;
  room: string;
  mode: "day" | "backlog" | "note";
  date: string | null;
  title: string;
  notes: Array<{ id: string; title: string }>;
  user: { id: string; name: string };
}) {
  const router = useRouter();
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const awarenessRef = useRef<{
    setLocalStateField: (field: string, value: unknown) => void;
  } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const touchedRef = useRef(false);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>(() => sharedStatus());
  const [peers, setPeers] = useState<Peer[]>([]);
  const [cursors, setCursors] = useState<CursorMap>({});
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState<BlockType>("text");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const userColor = useMemo(() => colorForUser(user.id), [user.id]);

  /** Keeps the shared store in step so the next room inherits this reading. */
  const applyStatus = useCallback((next: ConnectionStatus) => {
    setStatus(next);
    rememberStatus(next);
  }, []);

  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;

    const refresh = () => setBlocks(readBlocks(doc));
    doc.on("update", refresh);
    refresh();

    const localCache = new IndexeddbPersistence(`daystream:${room}`, doc);
    localCache.on("synced", () => setReady(true));

    let cancelled = false;
    let settled = false;
    let provider: HocuspocusProvider | null = null;

    const connect = async () => {
      try {
        const token = await fetchCollabToken(room);
        if (cancelled) return;

        provider = new HocuspocusProvider({
          url: collabUrl(),
          name: room,
          token,
          document: doc,
          onConnect: () => {
            settled = true;
            applyStatus("connected");
          },
          onSynced: () => {
            settled = true;
            applyStatus("connected");
            setReady(true);
          },
          onDisconnect: () => {
            applyStatus(navigator.onLine ? "reconnecting" : "offline");
          },
        });
        providerRef.current = provider;

        const awareness = provider.awareness;
        if (awareness) {
          awarenessRef.current = awareness;
          awareness.setLocalStateField("user", {
            id: user.id,
            name: user.name,
            color: userColor,
          });

          const syncPresence = () => {
            const nextPeers: Peer[] = [];
            const nextCursors: CursorMap = {};

            awareness.getStates().forEach((state, clientId) => {
              if (clientId === awareness.clientID) return;
              const info = state.user as { name?: string; color?: string } | undefined;
              if (!info?.name) return;

              const color = info.color ?? "#7c8cff";
              nextPeers.push({ id: clientId, name: info.name, color });

              const cursor = state.cursor as
                | { blockId?: unknown; start?: unknown; end?: unknown }
                | null
                | undefined;
              if (!cursor || typeof cursor.blockId !== "string") return;

              const start = typeof cursor.start === "number" ? cursor.start : 0;
              const end = typeof cursor.end === "number" ? cursor.end : start;
              (nextCursors[cursor.blockId] ??= []).push({
                id: clientId,
                name: info.name,
                color,
                start,
                end,
              });
            });

            setPeers(nextPeers);
            setCursors(nextCursors);
          };

          awareness.on("change", syncPresence);
          syncPresence();
        }
      } catch {
        if (!cancelled) applyStatus(navigator.onLine ? "reconnecting" : "offline");
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void connect();

    // A new room opens a new socket. Inherit the previous reading only for as
    // long as it takes to sync; after that, say what is actually true.
    const grace = window.setTimeout(() => {
      if (!settled) applyStatus(navigator.onLine ? "connecting" : "offline");
    }, 5000);

    const handleOnline = () => {
      applyStatus("reconnecting");
      provider?.connect();
    };
    const handleOffline = () => applyStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (!navigator.onLine) applyStatus("offline");

    return () => {
      cancelled = true;
      window.clearTimeout(grace);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      provider?.destroy();
      providerRef.current = null;
      awarenessRef.current = null;
      localCache.destroy();
      doc.off("update", refresh);
      doc.destroy();
      docRef.current = null;
    };
  }, [room, user.id, user.name, userColor, applyStatus]);

  /**
   * Publishes this user's caret so peers can draw it inside the right Thing.
   * Awareness is ephemeral: nothing here is persisted into the document.
   */
  const publishCursor = useCallback((blockId: string | null, start = 0, end = 0) => {
    const awareness = awarenessRef.current;
    if (!awareness) return;
    awareness.setLocalStateField("cursor", blockId ? { blockId, start, end } : null);
  }, []);

  const mutate = useCallback((fn: (array: Y.Array<Y.Map<unknown>>) => void) => {
    const doc = docRef.current;
    if (!doc) return;
    doc.transact(() => fn(doc.getArray<Y.Map<unknown>>(BLOCKS_KEY)));
  }, []);

  const addBlock = useCallback(
    (content: string, type: BlockType) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      mutate((array) => {
        array.push([
          createBlockMap({
            id: newBlockId(),
            type,
            content: trimmed,
            createdAt: Date.now(),
            createdBy: user.id,
          }),
        ]);
      });
      touchedRef.current = true;
    },
    [mutate, user.id],
  );

  const updateBlock = useCallback(
    (id: string, content: string) => {
      mutate((array) => {
        const target = array.toArray().find((map) => map.get("id") === id);
        if (target) target.set("content", content);
      });
      touchedRef.current = true;
    },
    [mutate],
  );

  const toggleBlock = useCallback(
    (id: string) => {
      mutate((array) => {
        const target = array.toArray().find((map) => map.get("id") === id);
        if (target) target.set("done", target.get("done") !== true);
      });
    },
    [mutate],
  );

  const convertBlock = useCallback(
    (id: string) => {
      mutate((array) => {
        const target = array.toArray().find((map) => map.get("id") === id);
        if (!target) return;
        const isTodo = target.get("type") === "todo";
        target.set("type", isTodo ? "text" : "todo");
        if (isTodo) target.set("done", false);
      });
      router.refresh();
    },
    [mutate, router],
  );

  /** Removal without ceremony: used when a move already owns the explanation. */
  const removeBlock = useCallback(
    (id: string) => {
      mutate((array) => {
        const index = array.toArray().findIndex((map) => map.get("id") === id);
        if (index >= 0) array.delete(index, 1);
      });
      router.refresh();
    },
    [mutate, router],
  );

  /**
   * A person deleting a line is the one place that needs an escape hatch, so the
   * removal is kept in memory until the toast expires (UX-18).
   */
  const deleteBlock = useCallback(
    (id: string) => {
      const captured: { value: { map: Y.Map<unknown>; index: number } | null } = { value: null };

      mutate((array) => {
        const index = array.toArray().findIndex((map) => map.get("id") === id);
        if (index < 0) return;
        captured.value = { map: array.get(index), index };
        array.delete(index, 1);
      });
      router.refresh();

      const removed = captured.value;
      if (!removed) return;

      showToast({
        message: "Thing deleted",
        action: {
          label: "Undo",
          run: () => {
            mutate((array) =>
              array.insert(Math.min(removed.index, array.length), [removed.map]),
            );
            router.refresh();
          },
        },
      });
    },
    [mutate, router],
  );

  /**
   * Carries one Thing into another document and removes the original. Every
   * move — to a day, to the backlog, into a Note — goes through here, so there
   * is exactly one copy of the transport (UI-09).
   */
  const carryBlock = useCallback(
    async (block: Block, targetRoom: string): Promise<boolean> => {
      if (targetRoom === room) return false;

      setPendingId(block.id);
      const socket: { provider: HocuspocusProvider | null } = { provider: null };
      const targetDoc = new Y.Doc();

      try {
        const token = await fetchCollabToken(targetRoom);
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("timeout")), 8000);
          socket.provider = new HocuspocusProvider({
            url: collabUrl(),
            name: targetRoom,
            token,
            document: targetDoc,
            onSynced: () => {
              window.clearTimeout(timeout);
              resolve();
            },
          });
        });

        targetDoc.transact(() => {
          const map = createBlockMap({
            id: block.id,
            type: block.type,
            content: block.content,
            createdAt: block.createdAt,
            createdBy: block.createdBy,
          });
          map.set("done", block.done);
          targetDoc.getArray<Y.Map<unknown>>(BLOCKS_KEY).push([map]);
        });

        // Give the socket a beat to flush before tearing it down.
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      } catch {
        setPendingId(null);
        return false;
      } finally {
        socket.provider?.destroy();
        targetDoc.destroy();
      }

      removeBlock(block.id);
      setPendingId(null);
      return true;
    },
    [removeBlock, room],
  );

  const moveBlock = useCallback(
    async (block: Block, target: "tomorrow" | "today" | "backlog") => {
      const targetDate =
        target === "backlog"
          ? null
          : target === "tomorrow"
            ? addDays(date ?? todayISO(), 1)
            : todayISO();
      const targetRoom = targetDate
        ? dayRoom(workspaceId, targetDate)
        : backlogRoom(workspaceId);

      const moved = await carryBlock(block, targetRoom);
      router.refresh();
      if (!moved) {
        showToast({
          message: "Couldn't move that Thing — it's still here.",
          tone: "error",
          action: { label: "Retry", run: () => void moveBlock(block, target) },
        });
        return;
      }
      showToast({
        message:
          target === "backlog"
            ? "Moved to the backlog"
            : target === "tomorrow"
              ? "Moved to tomorrow"
              : "Moved to today",
      });
    },
    [carryBlock, date, router, workspaceId],
  );

  /** Filing: a Thing stops being loose and joins the Note it belongs to. */
  const moveToNote = useCallback(
    async (block: Block, noteId: string) => {
      const destination = notes.find((note) => note.id === noteId);
      const moved = await carryBlock(block, noteRoom(noteId));
      router.refresh();
      if (!moved) {
        showToast({
          message: "Couldn't file that Thing — it's still here.",
          tone: "error",
          action: {
            label: "Retry",
            run: () => void moveToNote(block, noteId),
          },
        });
        return;
      }
      showToast({ message: `Filed into ${destination?.title ?? "that Note"}` });
    },
    [carryBlock, notes, router],
  );

  const submitDraft = useCallback(() => {
    const raw = draft.trim();
    if (!raw) return;
    const { content, isTask } = splitTaskPrefix(raw);
    if (!content) return;
    addBlock(content, isTask ? "todo" : draftType);
    setDraft("");
    setDraftType("text");
    composerRef.current?.focus();
  }, [addBlock, draft, draftType]);

  // Horizontal swipe moves between days (mobile).
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    if (mode !== "day" || !date || !touchStart.current) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
    router.push(`/app/${addDays(date, dx > 0 ? -1 : 1)}`);
  };

  const openTasks = blocks.filter((b) => b.type === "todo" && !b.done).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-edge bg-canvas/85 px-4 py-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted">{workspaceName}</p>
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        </div>

        {mode === "day" && date && (
          <nav className="flex items-center gap-1 text-xs text-muted" aria-label="Day navigation">
            <Link
              href={`/app/${addDays(date, -1)}`}
              className="rounded-md px-2 py-1 hover:bg-raised hover:text-ink"
              aria-label="Previous day"
            >
              ‹
            </Link>
            <Link href={`/app/${todayISO()}`} className="rounded-md px-2 py-1 hover:bg-raised hover:text-ink">
              Today
            </Link>
            <Link
              href={`/app/${addDays(date, 1)}`}
              className="rounded-md px-2 py-1 hover:bg-raised hover:text-ink"
              aria-label="Next day"
            >
              ›
            </Link>
          </nav>
        )}

        <StatusPill status={status} peers={peers} />
      </header>

      <div className="ds-scroll ds-stream flex-1 overflow-y-auto px-2 py-4 sm:px-6">
        <div className="mx-auto w-full">
          {!ready && blocks.length === 0 && (
            <p className="px-2 py-6 text-sm text-muted">Loading this day from your device…</p>
          )}

          {ready && blocks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-edge px-5 py-8 text-center">
              <p className="text-sm font-medium text-ink">
                {mode === "day" ? "Nothing here yet" : "Backlog is clear"}
              </p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
                {mode === "day"
                  ? "Type below and press Enter. Every line becomes its own Thing you can move, task, or delete."
                  : "Park undated thoughts here and move them into a day when they matter."}
              </p>
            </div>
          )}

          <div className="mt-1 flex flex-col">
            {blocks.map((block) => (
              <BlockItem
                key={block.id}
                block={block}
                mode={mode}
                pending={pendingId === block.id}
                cursors={cursors[block.id] ?? []}
                onCursor={publishCursor}
                onChange={(content) => updateBlock(block.id, content)}
                onToggle={() => toggleBlock(block.id)}
                onDelete={() => deleteBlock(block.id)}
                onConvert={() => convertBlock(block.id)}
                onMove={(target) => void moveBlock(block, target)}
                notes={notes}
                onMoveToNote={(noteId) => void moveToNote(block, noteId)}
              />
            ))}
          </div>

          {mode === "day" && openTasks > 0 && (
            <p className="px-2 pt-4 text-[11px] text-muted">
              {openTasks} open {openTasks === 1 ? "task" : "tasks"} on this day.
            </p>
          )}
        </div>
      </div>

      <form
        className="safe-bottom sticky bottom-0 border-t border-edge bg-canvas/95 px-3 py-3 backdrop-blur sm:px-4"
        style={{ marginBottom: "var(--keyboard-inset, 0px)" }}
        onSubmit={(event) => {
          event.preventDefault();
          submitDraft();
        }}
      >
        <div className="mx-auto w-full rounded-2xl border border-edge bg-panel px-2.5 py-2 focus-within:border-accent/60">
          <div className="flex items-end gap-2 px-0.5">
            <textarea
              ref={composerRef}
              value={draft}
              rows={1}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={(event) => {
                const el = event.currentTarget;
                window.setTimeout(() => el.scrollIntoView({ block: "nearest" }), 250);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitDraft();
                }
              }}
              placeholder={
                mode === "day"
                  ? "Add a thing for this day…"
                  : mode === "backlog"
                    ? "Add to the backlog…"
                    : "Add a thing to this note…"
              }
              className="ds-textarea"
              aria-label="New thing"
              spellCheck
              autoCapitalize="sentences"
              autoComplete="off"
              enterKeyHint="enter"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="ds-button ds-button-primary shrink-0 px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <FormatBar
            targetRef={composerRef}
            onChange={setDraft}
            taskActive={draftType === "todo"}
            onToggleTask={() => setDraftType((current) => (current === "todo" ? "text" : "todo"))}
          />
        </div>
        <p className="mx-auto mt-1.5 w-full px-1 text-[11px] text-muted">
          {/* Name the destination rather than asking for it (UX-01, UX-09). */}
          {mode === "note" ? `Goes into ${title}.` : "Goes into your Inbox."}{" "}
          Saved on this device instantly; the pill above says when it reached the server.
        </p>
      </form>
    </div>
  );
}
