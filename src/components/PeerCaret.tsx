"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { PeerCursor } from "@/lib/presence";

type Position = { left: number; top: number; height: number };

/**
 * Draws one remote caret at a character offset.
 *
 * The offset is turned into pixels by laying the same text out in an invisible
 * mirror with the same typography, then reading where a zero-width marker lands.
 * The caret and its name tag are positioned in that same coordinate space, which
 * is why the overlay wrapper must share the text container's box.
 */
function CaretOverlay({ text, cursor }: { text: string; cursor: PeerCursor }) {
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const index = Math.max(0, Math.min(cursor.start, text.length));

  useLayoutEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const measure = () =>
      setPosition({
        left: marker.offsetLeft,
        top: marker.offsetTop,
        height: marker.offsetHeight,
      });

    measure();
    const observer = new ResizeObserver(measure);
    if (mirrorRef.current) observer.observe(mirrorRef.current);
    return () => observer.disconnect();
  }, [text, index]);

  return (
    <>
      <span
        ref={mirrorRef}
        aria-hidden
        className="pointer-events-none invisible absolute inset-x-0 top-0 whitespace-pre-wrap text-[16px] leading-relaxed"
      >
        {text.slice(0, index)}
        <span ref={markerRef}>{"\u200b"}</span>
        {text.slice(index)}
      </span>

      {position && (
        <span
          className="pointer-events-none absolute z-10"
          style={{ left: position.left, top: position.top }}
        >
          <span
            className="block w-[2px] rounded-full"
            style={{ backgroundColor: cursor.color, height: position.height || 20 }}
          />
          <span
            className="absolute -top-4 left-0 whitespace-nowrap rounded px-1 py-[1px] text-[10px] font-medium leading-tight text-black"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.name}
          </span>
        </span>
      )}
    </>
  );
}

/** Every remote caret inside one Thing. Renders nothing when nobody is there. */
export function PeerCarets({ text, cursors }: { text: string; cursors: PeerCursor[] }) {
  if (cursors.length === 0) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {cursors.map((cursor) => (
        <CaretOverlay key={cursor.id} text={text} cursor={cursor} />
      ))}
    </span>
  );
}
