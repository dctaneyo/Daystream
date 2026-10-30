"use client";

import { useEffect, useRef, useState } from "react";
import type { Block } from "@/lib/blocks";
import { FormatBar } from "@/components/FormatBar";
import { InlineMarkdown } from "@/components/InlineMarkdown";

export function BlockItem({
  block,
  mode,
  pending,
  onChange,
  onToggle,
  onDelete,
  onMove,
  onConvert,
}: {
  block: Block;
  mode: "day" | "backlog";
  pending: boolean;
  onChange: (content: string) => void;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (target: "tomorrow" | "today" | "backlog") => void;
  onConvert: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.content, editing]);

  const beginEditing = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
  };

  const isTodo = block.type === "todo" || block.type === "reminder";

  return (
    <div
      className={`group relative flex items-start gap-2.5 rounded-xl px-2 py-1.5 transition ${
        pending ? "opacity-40" : "hover:bg-raised/50"
      }`}
    >
      {isTodo ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={block.done ? "Mark as not done" : "Mark as done"}
          aria-pressed={block.done}
          className={`mt-1.5 grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border text-[10px] transition ${
            block.done
              ? "border-accent bg-accent text-accent-ink"
              : "border-edge bg-transparent text-transparent hover:border-muted"
          }`}
        >
          ✓
        </button>
      ) : (
        <span aria-hidden className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-muted/50" />
      )}

      <div className="min-w-0 flex-1">
        {editing ? (
          <div>
            <textarea
              ref={textareaRef}
              value={block.content}
              rows={1}
              onChange={(event) => onChange(event.target.value)}
              onBlur={() => {
                if (block.content.trim()) setEditing(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  onConvert();
                }
                if (event.key === "Escape") event.currentTarget.blur();
              }}
              placeholder="Type a thing…"
              className={`ds-textarea pt-0.5 ${block.done ? "text-muted line-through" : ""}`}
              spellCheck
              autoCapitalize="sentences"
              enterKeyHint="enter"
            />
            <FormatBar
              compact
              targetRef={textareaRef}
              onChange={onChange}
              taskActive={isTodo}
              onToggleTask={onConvert}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={beginEditing}
            className={`w-full whitespace-pre-wrap text-left text-[16px] leading-relaxed ${
              block.done ? "text-muted line-through" : "text-ink"
            }`}
          >
            {block.content.trim() ? (
              <InlineMarkdown text={block.content} />
            ) : (
              <span className="text-muted">Type a thing…</span>
            )}
          </button>
        )}
      </div>

      <div
        className={`flex shrink-0 items-center gap-0.5 transition ${
          menuOpen
            ? "opacity-100"
            : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Thing actions"
          aria-expanded={menuOpen}
          className="rounded-md px-1.5 py-1 text-xs text-muted hover:bg-panel hover:text-ink"
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-xl border border-edge bg-panel shadow-xl">
            <button
              type="button"
              onClick={() => {
                onConvert();
                setMenuOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-xs text-ink hover:bg-raised"
            >
              {isTodo ? "Convert to note" : "Convert to task"}
            </button>
            {mode === "day" && (
              <button
                type="button"
                onClick={() => {
                  onMove("tomorrow");
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs text-ink hover:bg-raised"
              >
                Move to tomorrow
              </button>
            )}
            {mode === "backlog" ? (
              <button
                type="button"
                onClick={() => {
                  onMove("today");
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs text-ink hover:bg-raised"
              >
                Move to today
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onMove("backlog");
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs text-ink hover:bg-raised"
              >
                Move to backlog
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-raised dark:text-red-300"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
