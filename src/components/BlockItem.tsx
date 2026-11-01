"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Block } from "@/lib/blocks";
import { FormatBar } from "@/components/FormatBar";
import { InlineMarkdown } from "@/components/InlineMarkdown";
import { PeerCarets } from "@/components/PeerCaret";
import type { PeerCursor } from "@/lib/presence";

const MENU_WIDTH = 176;
const MENU_GAP = 6;
const ITEM_HEIGHT = 38;

type MenuPosition = { left: number; top?: number; bottom?: number };

export function BlockItem({
  block,
  mode,
  pending,
  cursors,
  onChange,
  onToggle,
  onDelete,
  onMove,
  onConvert,
  onCursor,
}: {
  block: Block;
  mode: "day" | "backlog" | "note";
  pending: boolean;
  cursors: PeerCursor[];
  onChange: (content: string) => void;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (target: "tomorrow" | "today" | "backlog") => void;
  onConvert: () => void;
  onCursor: (blockId: string | null, start?: number, end?: number) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.content, editing]);

  /**
   * The menu renders in a portal, so the scrolling column and the composer can
   * never clip it. Measure the trigger, then place the menu against it.
   */
  const toggleMenu = useCallback(() => {
    const button = menuButtonRef.current;
    if (menuOpen || !button) {
      setMenuOpen(false);
      return;
    }

    const estimatedHeight = (mode === "day" ? 4 : 3) * ITEM_HEIGHT + 10;
    const rect = button.getBoundingClientRect();
    const width = Math.min(MENU_WIDTH, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    const flipUp =
      window.innerHeight - rect.bottom < estimatedHeight + 12 && rect.top > estimatedHeight + 12;

    setMenuPosition(
      flipUp
        ? { left, bottom: window.innerHeight - rect.top + MENU_GAP }
        : { left, top: rect.bottom + MENU_GAP },
    );
    setMenuOpen(true);
  }, [menuOpen, mode]);

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

    // `true` also catches scrolling inside the stream, not just the window.
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

  const reportCursor = (el: HTMLTextAreaElement) => {
    if (el.selectionStart === null) return;
    onCursor(block.id, el.selectionStart, el.selectionEnd ?? el.selectionStart);
  };

  const beginEditing = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const run = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  const isTodo = block.type === "todo" || block.type === "reminder";

  const items: Array<{ label: string; onClick: () => void; danger?: boolean }> = [
    { label: isTodo ? "Convert to Text" : "Convert to Task", onClick: onConvert },
  ];
  if (mode === "day") {
    items.push({ label: "Move to tomorrow", onClick: () => onMove("tomorrow") });
    items.push({ label: "Move to backlog", onClick: () => onMove("backlog") });
  }
  if (mode === "backlog") {
    items.push({ label: "Move to today", onClick: () => onMove("today") });
  }
  items.push({ label: "Delete", onClick: onDelete, danger: true });

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
              onChange={(event) => {
                onChange(event.target.value);
                reportCursor(event.currentTarget);
              }}
              onSelect={(event) => reportCursor(event.currentTarget)}
              onKeyUp={(event) => reportCursor(event.currentTarget)}
              onClick={(event) => reportCursor(event.currentTarget)}
              onBlur={() => {
                onCursor(null);
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
            className={`relative w-full whitespace-pre-wrap text-left text-[16px] leading-relaxed ${
              block.done ? "text-muted line-through" : "text-ink"
            }`}
          >
            {block.content.trim() ? (
              <InlineMarkdown text={block.content} />
            ) : (
              <span className="text-muted">Type a thing…</span>
            )}
            <PeerCarets text={block.content} cursors={cursors} />
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
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => run(item.onClick)}
                className={`block w-full px-3 py-2.5 text-left text-xs hover:bg-raised ${
                  item.danger ? "text-red-600 dark:text-red-300" : "text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
