"use client";

import type { RefObject } from "react";
import { applyFormatValue, type FormatKind } from "@/lib/format-text";

const BUTTONS: Array<{ kind: FormatKind; label: string; title: string; className?: string }> = [
  { kind: "bold", label: "B", title: "Bold", className: "font-semibold" },
  { kind: "italic", label: "I", title: "Italic", className: "italic" },
  { kind: "strike", label: "S", title: "Strikethrough", className: "line-through" },
  { kind: "code", label: "</>", title: "Code" },
  { kind: "bullet", label: "•", title: "Bullet" },
  { kind: "link", label: "[[ ]]", title: "Wikilink" },
];

/**
 * Formatting accessory bar that sits above the text field, like a native input
 * assistant. It never replaces the on-screen keyboard — it augments it.
 * `onPointerDown` preventDefault keeps the field focused, so the keyboard does
 * not collapse when a format button is tapped.
 */
export function FormatBar({
  targetRef,
  onChange,
  taskActive,
  onToggleTask,
  compact = false,
}: {
  targetRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  taskActive?: boolean;
  onToggleTask?: () => void;
  compact?: boolean;
}) {
  const apply = (kind: FormatKind) => {
    const el = targetRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const result = applyFormatValue(el.value, start, end, kind);
    onChange(result.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  /**
   * `Shift+Enter` is the desktop way to start a second line, and no phone
   * keyboard offers Shift while typing — so the line break gets a control
   * (UX-31, UX-32).
   */
  const insertLineBreak = () => {
    const el = targetRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = `${el.value.slice(0, start)}\n${el.value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 1, start + 1);
    });
  };

  return (
    <div
      role="toolbar"
      aria-label="Format text"
      className={`no-scrollbar flex items-center gap-1 overflow-x-auto ${
        compact ? "mt-1 border-t border-edge/50 pt-1" : "mt-1.5 border-t border-edge/60 pt-1.5"
      }`}
    >
      {onToggleTask && (
        <button
          type="button"
          data-format="task"
          aria-pressed={taskActive}
          onPointerDown={(event) => event.preventDefault()}
          onClick={onToggleTask}
          className={`min-h-11 shrink-0 rounded-lg px-3 text-xs font-medium transition ${
            taskActive ? "bg-accent text-accent-ink" : "text-muted hover:bg-raised hover:text-ink"
          }`}
        >
          Task
        </button>
      )}

      <button
        type="button"
        data-format="linebreak"
        title="Line break"
        aria-label="Line break"
        onPointerDown={(event) => event.preventDefault()}
        onClick={insertLineBreak}
        className="min-h-11 min-w-11 shrink-0 rounded-lg text-sm text-muted transition hover:bg-raised hover:text-ink"
      >
        ↵
      </button>

      {BUTTONS.map((button) => (
        <button
          key={button.kind}
          type="button"
          data-format={button.kind}
          title={button.title}
          aria-label={button.title}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => apply(button.kind)}
          className={`min-h-11 min-w-11 shrink-0 rounded-lg text-xs text-muted transition hover:bg-raised hover:text-ink ${button.className ?? ""}`}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
