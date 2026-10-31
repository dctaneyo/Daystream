"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Block } from "@/lib/blocks";
import { FormatBar } from "@/components/FormatBar";
import { InlineMarkdown } from "@/components/InlineMarkdown";

const MENU_WIDTH = 176;
const MENU_GAP = 6;
const MENU_ITEM_HEIGHT = 38;

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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.content, editing]);

  /**
   * The menu lives in a portal, so the scrolling column and the composer can
   * never clip it. Measure the trigger and place it there instead.
   */
  const toggleMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const button = menuButtonRef.current;
    if (!button) return;

    const itemCount = mode === "day" ? 4 : 3;
    const estimatedHeight = itemCount * MENU_ITEM_HEIGHT + 10;
    const rect = button.getBoundingClientRect();
    const width = Math.min(MENU_WIDTH, window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, rect.right - width),
      Math.max(8, window.innerWidth - width - 8),
    );
    const flipUp =
      window.innerHeight - rect.bottom < estimatedHeight + 12 && rect.top > estimatedHeight + 12;

    setMenuPosition(
      flipUp
        ? { left, bottom: window.innerHeight - rect.top + MENU_GAP }
        : { left, top: rect.bottom + MENU_GAP },
    );
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;

    const close = () => setMenuOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    // `true` catches scrolling inside the stream, not just the window.
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

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

  const run = (action: () => void) => {
    action();
    setMenuOpen(false);
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
          ref={menuButtonRef}
          type="button"
          onClick={toggleMenu}
          aria-label="Thing actions"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="rounded-md px-1.5 py-1 text-xs text-muted hover:bg-panel hover:text-ink"
        >
          ⋯
        </button>
      </div>

      {menuOpen &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              left: menuPosition.left,
              top: menuPosition.top,
              bottom: menuPosition.bottom,
              width: Math.min(MENU_WIDTH, window.innerWidth - 16),
            }}
            className="z-50 overflow-hidden rounded-xl border border-edge bg-panel shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => run(onConvert)}
              className="block w-full px-3 py-2.5 text-left text-xs text-ink hover:bg-raised"
            >
              {isTodo ? "Convert to note" : "Convert to task"}
            </button>
            {mode === "day" && (
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onMove("tomorrow"))}
                className="block w-full px-3 py-2.5 text-left text-xs text-ink hover:bg-raised"
              >
                Move to tomorrow
              </button>
            )}
            {mode === "backlog" ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onMove("today"))}
                className="block w-full px-3 py-2.5 text-left text-xs text-ink hover:bg-raised"
              >
                Move to today
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onMove("backlog"))}
                className="block w-full px-3 py-2.5 text-left text-xs text-ink hover:bg-raised"
              >
                Move to backlog
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => run(onDelete)}
              className="block w-full px-3 py-2.5 text-left text-xs text-red-600 hover:bg-raised dark:text-red-300"
            >
              Delete
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
