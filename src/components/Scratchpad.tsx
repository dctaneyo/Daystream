"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { BLOCKS_KEY, createBlockMap, newBlockId, readBlocks, type Block } from "@/lib/blocks";
import { collabUrl, fetchCollabToken } from "@/lib/collab-client";
import { splitTaskPrefix } from "@/lib/format-text";

/**
 * The scratchpad is a real editor for the backlog room, not a link to it.
 * It opens the same Yjs document the backlog page uses, so anything typed here
 * appears there instantly and syncs to other devices.
 */
export function Scratchpad({ room, userId }: { room: string; userId: string }) {
  const docRef = useRef<Y.Doc | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;

    const refresh = () => setBlocks(readBlocks(doc));
    doc.on("update", refresh);
    refresh();

    const cache = new IndexeddbPersistence(`daystream:${room}`, doc);
    let cancelled = false;
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
          onConnect: () => setLive(true),
          onSynced: () => setLive(true),
          onDisconnect: () => setLive(false),
        });
      } catch {
        if (!cancelled) setLive(false);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      provider?.destroy();
      cache.destroy();
      doc.off("update", refresh);
      doc.destroy();
      docRef.current = null;
    };
  }, [room]);

  const submit = useCallback(() => {
    const raw = draft.trim();
    if (!raw) return;
    const doc = docRef.current;
    if (!doc) return;

    const { content, isTask } = splitTaskPrefix(raw);
    if (!content) return;

    setSaving(true);
    doc.transact(() => {
      doc.getArray<Y.Map<unknown>>(BLOCKS_KEY).push([
        createBlockMap({
          id: newBlockId(),
          type: isTask ? "todo" : "text",
          content,
          createdAt: Date.now(),
          createdBy: userId,
        }),
      ]);
    });
    setDraft("");
    setSaving(false);
  }, [draft, userId]);

  const recent = blocks.slice(-3).reverse();

  return (
    <section className="rounded-xl border border-edge bg-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Scratchpad</h2>
        <span
          className={`flex items-center gap-1 text-[10px] ${live ? "text-muted" : "text-warning"}`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${live ? "bg-success" : "bg-warning"}`}
          />
          {live ? "Synced" : "Local"}
        </span>
      </div>

      <form
        className="mt-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          value={draft}
          rows={2}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Jot something down…"
          aria-label="Add to the backlog"
          className="ds-textarea rounded-lg border border-edge bg-raised px-2.5 py-2 text-sm"
          spellCheck
          autoCapitalize="sentences"
          enterKeyHint="enter"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted">Enter saves · Shift+Enter adds a line</span>
          <button
            type="submit"
            disabled={!draft.trim() || saving}
            className="ds-button ds-button-primary px-2.5 py-1 text-[11px] disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </form>

      {recent.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1 border-t border-edge/60 pt-2">
          {recent.map((block) => (
            <li key={block.id} className="truncate text-[11px] text-muted">
              {block.type === "todo" ? "☐ " : "• "}
              {block.content}
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/app/backlog"
        className="mt-2 inline-block text-[11px] text-accent hover:underline"
      >
        Open backlog →
      </Link>
    </section>
  );
}
