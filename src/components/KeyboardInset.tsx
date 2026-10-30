"use client";

import { useEffect } from "react";

/**
 * Mirrors the on-screen keyboard height into `--keyboard-inset`.
 *
 * iOS Safari does not resize the layout viewport when the keyboard opens, so
 * without this the composer ends up underneath it. Android (with
 * `interactive-widget=resizes-content`) usually needs no help, and the computed
 * inset is 0 there.
 */
export function KeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const inset = Math.max(
          0,
          Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
        );
        // Ignore browser-chrome noise; only a real keyboard is this tall.
        const keyboard = inset > 120 ? inset : 0;
        root.style.setProperty("--keyboard-inset", `${keyboard}px`);
        root.classList.toggle("kb-open", keyboard > 0);
      });
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);

    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
      root.style.removeProperty("--keyboard-inset");
      root.classList.remove("kb-open");
    };
  }, []);

  return null;
}
