"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { BLOCKS_KEY, createBlockMap, newBlockId, readBlocks, type Block } from "@/lib/blocks";
import { noteRoom } from "@/lib/rooms";
import { collabUrl, fetchCollabToken } from "@/lib/collab-client";
import { runBuildCheck } from "@/lib/build-check";
import { showToast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NoteSharePanel } from "@/components/NoteSharePanel";
import { Sheet } from "@/components/Sheet";
import type { ConnectionStatus } from "@/components/StatusPill";
import type { DayNote } from "@/lib/day-view";

/** Textareas grow with their content so a Thing never scrolls inside the page. */
function resize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * A Note is the page, not a destination. Its title and its Things are edited in
 * place, in the same scroll as every other Note on the day, and every line is a
 * Thing of its own — type, press return, keep going (UX-23, UX-33).
 */
export function NoteSurface({
  note,
  user,
  onDeleted,
  onStatus,
  autoFocus = false,
}: {
  note: DayNote;
  user: { id: string; name: string };
  onDeleted: (noteId: string) => void;
  onStatus: (status: ConnectionStatus) => void;
  autoFocus?: boolean;
}) {
  const room = useMemo(() => noteRoom(note.id), [note.id]);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState(note.title);
  const [savedTitle, setSavedTitle] = useState(note.title);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const inputs = useRef(new Map<string, HTMLTextAreaElement>());
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const focusRef = useRef<string | null>(autoFocus ? "__first__" : null);

  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;

    const refresh = () => setBlocks(readBlocks(doc));
    doc.on("update", refresh);
    refresh();

    const cache = new IndexeddbPersistence(`daystream:${room}`, doc);
    cache.on("synced", () => setReady(true));

    let cancelled = false;
    let provider: HocuspocusProvider | null = null;

    void (async () => {
      try {
        const token = await fetchCollabToken(room);
        if (cancelled) return;
        provider = new HocuspocusProvider({
          url: collabUrl(),
          name: room,
          token,
          document: doc,
          onConnect: () => {
            onStatus("connected");
            runBuildCheck();
          },
          onSynced: () => {
            onStatus("connected");
            setReady(true);
            runBuildCheck();
          },
          onDisconnect: () => {
            onStatus(navigator.onLine ? "reconnecting" : "offline");
          },
        });
        providerRef.current = provider;
      } catch {
        if (!cancelled) onStatus(navigator.onLine ? "reconnecting" : "offline");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      provider?.destroy();
      providerRef.current = null;
      cache.destroy();
      doc.off("update", refresh);
      doc.destroy();
      docRef.current = null;
    };
  }, [onStatus, room]);

  const mutate = useCallback((fn: (array: Y.Array<Y.Map<unknown>>) => void) => {
    const doc = docRef.current;
    if (!doc) return;
    doc.transact(() => fn(doc.getArray<Y.Map<unknown>>(BLOCKS_KEY)));
  }, []);

  const insertBlock = useCallback(
    (afterId: string | null, content = "") => {
      const id = newBlockId();
      mutate((array) => {
        const map = createBlockMap({
          id,
          type: "text",
          content,
          createdAt: Date.now(),
          createdBy: user.id,
        });
        if (!afterId) {
          array.push([map]);
          return;
        }
        const index = array.toArray().findIndex((entry) => entry.get("id") === afterId);
        array.insert(index < 0 ? array.length : index + 1, [map]);
      });
      focusRef.current = id;
    },
    [mutate, user.id],
  );

  const setContent = useCallback(
    (id: string, content: string) => {
      mutate((array) => {
        const map = array.toArray().find((entry) => entry.get("id") === id);
        if (map) map.set("content", content);
      });
    },
    [mutate],
  );

  /** Tapping the dot on a line turns it into a task; tapping a task checks it. */
  const toggle = useCallback(
    (block: Block) => {
      mutate((array) => {
        const map = array.toArray().find((entry) => entry.get("id") === block.id);
        if (!map) return;
        if (block.type === "todo") {
          map.set("done", block.done !== true);
        } else {
          map.set("type", "todo");
          map.set("done", false);
        }
      });
    },
    [mutate],
  );

  const deleteLine = useCallback(
    (id: string) => {
      const captured: { value: { map: Y.Map<unknown>; index: number } | null } = { value: null };
      mutate((array) => {
        const index = array.toArray().findIndex((entry) => entry.get("id") === id);
        if (index < 0) return;
        captured.value = { map: array.get(index), index };
        array.delete(index, 1);
      });
      const removed = captured.value;
      if (!removed) return;
      showToast({
        message: "Deleted",
        action: {
          label: "Undo",
          run: () =>
            mutate((array) => array.insert(Math.min(removed.index, array.length), [removed.map])),
        },
      });
    },
    [mutate],
  );

  // Focus follows the line that was just created or removed.
  useEffect(() => {
    const id = focusRef.current;
    if (!id) return;
    if (id === "__first__") {
      if (!ready) return;
      focusRef.current = null;
      const last = blocks[blocks.length - 1];
      const el = last ? inputs.current.get(last.id) : titleRef.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
      return;
    }
    const el = inputs.current.get(id);
    if (!el) return;
    focusRef.current = null;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [blocks, ready]);

  const saveTitle = useCallback(async () => {
    const next = title.trim().slice(0, 120) || "Untitled note";
    setTitle(next);
    if (next === savedTitle) return;
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!response.ok) throw new Error();
      setSavedTitle(next);
    } catch {
      showToast({ message: "Couldn't rename that Note.", tone: "error" });
      setTitle(savedTitle);
    }
  }, [note.id, savedTitle, title]);

  const deleteNote = useCallback(async () => {
    setConfirmingDelete(false);
    try {
      const response = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      onDeleted(note.id);
      showToast({ message: "Note deleted" });
    } catch {
      showToast({ message: "Couldn't delete that Note.", tone: "error" });
    }
  }, [note.id, onDeleted]);

  return (
    <section data-note-id={note.id} className="group/note">
      <div className="flex items-start gap-2">
        <textarea
          ref={titleRef}
          value={title}
          rows={1}
          onChange={(event) => {
            setTitle(event.target.value);
            resize(event.currentTarget);
          }}
          onBlur={() => void saveTitle()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
              insertBlock(blocks[blocks.length - 1]?.id ?? null);
            }
          }}
          aria-label="Note title"
          maxLength={120}
          className="min-w-0 flex-1 resize-none border-none bg-transparent p-0 text-lg font-semibold leading-7 tracking-tight text-ink outline-none placeholder:text-muted"
          placeholder="Untitled note"
        />

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={`Note options for ${note.title}`}
            aria-expanded={menuOpen}
            className="grid h-11 w-9 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
          >
            ⋯
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-xl border border-edge bg-panel py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setShareOpen(true);
                  }}
                  className="flex min-h-11 w-full items-center px-3 text-left text-sm text-ink hover:bg-raised"
                >
                  Share
                </button>
                {note.canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmingDelete(true);
                    }}
                    className="flex min-h-11 w-full items-center px-3 text-left text-sm text-danger hover:bg-raised"
                  >
                    Delete note
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <p className="mt-0.5 text-[11px] text-muted">
        {note.sharedWithMe ? "Shared with you" : `${blocks.length} ${blocks.length === 1 ? "Thing" : "Things"}`}
      </p>

      <div className="mt-2 flex flex-col">
        {blocks.map((block) => (
          <div key={block.id} className="group/line flex items-start gap-2">
            <button
              type="button"
              onClick={() => toggle(block)}
              aria-label={block.type === "todo" ? (block.done ? "Mark not done" : "Mark done") : "Make it a task"}
              aria-pressed={block.type === "todo" ? block.done : undefined}
              className={`mt-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] transition ${
                block.type === "todo"
                  ? block.done
                    ? "border border-accent/50 bg-accent/15 text-accent"
                    : "border border-edge text-transparent"
                  : "text-transparent opacity-0 hover:border hover:border-edge focus-visible:opacity-100 group-hover/line:opacity-100"
              }`}
            >
              {block.done ? "✓" : "○"}
            </button>

            <textarea
              value={block.content}
              rows={1}
              ref={(el) => {
                if (!el) {
                  inputs.current.delete(block.id);
                  return;
                }
                inputs.current.set(block.id, el);
                resize(el);
              }}
              onChange={(event) => {
                setContent(block.id, event.target.value);
                resize(event.currentTarget);
              }}
              onInput={(event) => resize(event.currentTarget)}
              onKeyDown={(event) => {
                const el = event.currentTarget;
                if (event.key === "Enter") {
                  event.preventDefault();
                  insertBlock(block.id);
                  return;
                }
                if (
                  event.key === "Backspace" &&
                  block.content === "" &&
                  el.selectionStart === 0 &&
                  el.selectionEnd === 0
                ) {
                  event.preventDefault();
                  const index = blocks.findIndex((entry) => entry.id === block.id);
                  const previous = blocks[index - 1];
                  deleteLine(block.id);
                  if (previous) {
                    focusRef.current = previous.id;
                    setBlocks((current) => current);
                  }
                }
              }}
              onPaste={(event) => {
                const text = event.clipboardData.getData("text");
                if (!text.includes("\n")) return;
                event.preventDefault();
                const lines = text.split(/\r?\n/);
                setContent(block.id, [block.content, ...lines].join("\n").trim());
              }}
              placeholder={
                blocks.length === 1 && block.content === ""
                  ? "Start typing — press return for the next Thing."
                  : ""
              }
              aria-label="Thing"
              spellCheck
              autoCapitalize="sentences"
              autoComplete="off"
              enterKeyHint="enter"
              className={`min-w-0 flex-1 resize-none whitespace-pre-wrap border-none bg-transparent p-0 text-[15px] leading-8 outline-none placeholder:text-muted ${
                block.done ? "text-muted line-through" : "text-ink"
              }`}
            />
          </div>
        ))}

        {ready && blocks.length === 0 && (
          <textarea
            rows={1}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              insertBlock(null, value);
              event.target.value = "";
            }}
            aria-label="First Thing"
            placeholder="Start typing — press return for the next Thing."
            autoComplete="off"
            enterKeyHint="enter"
            className="min-w-0 flex-1 resize-none border-none bg-transparent p-0 pl-8 text-[15px] leading-8 text-ink outline-none placeholder:text-muted"
          />
        )}
      </div>

      <Sheet open={shareOpen} title={`Share “${note.title}”`} onClose={() => setShareOpen(false)}>
        <NoteSharePanel
          noteId={note.id}
          title={note.title}
          members={note.members}
          canManage={note.canManage}
          sharedWithMe={note.sharedWithMe}
          thingCount={note.thingCount}
        />
      </Sheet>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete “${note.title}”?`}
        description={
          note.thingCount > 0
            ? `Its ${note.thingCount} ${note.thingCount === 1 ? "Thing" : "Things"} go with it. This cannot be undone.`
            : "Every Thing in it goes with it. This cannot be undone."
        }
        confirmLabel="Delete note"
        destructive
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => void deleteNote()}
      />
    </section>
  );
}
