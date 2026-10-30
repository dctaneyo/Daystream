export type FormatKind = "bold" | "italic" | "strike" | "code" | "bullet" | "task" | "link";

export type FormatResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const WRAPPERS: Record<string, string> = {
  bold: "**",
  italic: "*",
  strike: "~~",
  code: "`",
};

/**
 * Applies a lightweight markdown format to a textarea value, returning the new
 * value plus where the selection should land. Pure so it can be unit tested and
 * shared by the composer and the per-block editor.
 */
export function applyFormatValue(
  value: string,
  start: number,
  end: number,
  kind: FormatKind,
): FormatResult {
  if (kind === "bullet") return prefixLine(value, start, end, "- ");
  if (kind === "task") return prefixLine(value, start, end, "[ ] ");

  if (kind === "link") {
    const selected = value.slice(start, end);
    return {
      value: `${value.slice(0, start)}[[${selected}]]${value.slice(end)}`,
      selectionStart: start + 2,
      selectionEnd: start + 2 + selected.length,
    };
  }

  const marker = WRAPPERS[kind];
  if (!marker) return { value, selectionStart: start, selectionEnd: end };

  const selected = value.slice(start, end);
  const before = value.slice(Math.max(0, start - marker.length), start);
  const after = value.slice(end, end + marker.length);

  // Toggle off when the selection is already wrapped.
  if (before === marker && after === marker) {
    return {
      value: `${value.slice(0, start - marker.length)}${selected}${value.slice(end + marker.length)}`,
      selectionStart: start - marker.length,
      selectionEnd: end - marker.length,
    };
  }

  return {
    value: `${value.slice(0, start)}${marker}${selected}${marker}${value.slice(end)}`,
    selectionStart: start + marker.length,
    selectionEnd: end + marker.length,
  };
}

function prefixLine(value: string, start: number, end: number, prefix: string): FormatResult {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const line = value.slice(lineStart, end);

  if (line.startsWith(prefix)) {
    return {
      value: `${value.slice(0, lineStart)}${line.slice(prefix.length)}${value.slice(end)}`,
      selectionStart: Math.max(lineStart, start - prefix.length),
      selectionEnd: Math.max(lineStart, end - prefix.length),
    };
  }

  return {
    value: `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`,
    selectionStart: start + prefix.length,
    selectionEnd: end + prefix.length,
  };
}

/** A "[ ] " prefix typed by the user becomes a todo block. */
export function splitTaskPrefix(value: string): { content: string; isTask: boolean } {
  const match = value.match(/^\[\s?\]\s+([\s\S]*)$/);
  if (match) return { content: match[1]!.trim(), isTask: true };
  return { content: value.trim(), isTask: false };
}
