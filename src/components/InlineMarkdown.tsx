import type { ReactNode } from "react";

const TOKEN = /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|`[^`\n]+`|\[\[[^\]\n]+\]\]|\*[^*\n]+\*)/g;

/**
 * Tiny inline markdown renderer: **bold**, *italic*, ~~strike~~, `code` and
 * [[wikilinks]]. Deliberately not a full markdown engine — the block model keeps
 * structure (tasks, order, dates) outside the text.
 */
export function InlineMarkdown({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];

    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("~~")) {
      nodes.push(
        <s key={key++} className="text-muted">
          {token.slice(2, -2)}
        </s>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key++} className="rounded bg-raised px-1 py-0.5 font-mono text-[0.9em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[[")) {
      nodes.push(
        <span
          key={key++}
          className="rounded bg-accent/10 px-1 text-accent underline decoration-accent/30 underline-offset-2"
        >
          {token.slice(2, -2)}
        </span>,
      );
    } else {
      nodes.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}
