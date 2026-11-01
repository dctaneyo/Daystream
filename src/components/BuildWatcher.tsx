"use client";

import { useCallback, useEffect, useState } from "react";
import { registerBuildCheck } from "@/lib/build-check";

const SPLASH_MS = 900;
const STUCK_MS = 5000;

function runningBuild(): string | null {
  const meta = document.querySelector('meta[name="daystream-build"]');
  return meta?.getAttribute("content") ?? null;
}

/**
 * A tab left open across a deploy keeps running the old bundle: the socket
 * reconnects, but the code is from yesterday. This compares the running build
 * with the served one and, when they differ, says so and reloads once
 * (UX-34). It never reloads in a loop: the splash only appears on a difference,
 * and the new HTML carries the new id.
 */
export function BuildWatcher() {
  const [incoming, setIncoming] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);

  const check = useCallback(async () => {
    const local = runningBuild();
    if (!local || local === "dev") return;
    try {
      const response = await fetch("/api/version", { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { id?: string };
      if (body.id && body.id !== local) setIncoming(body.id);
    } catch {
      // Offline: the connection pill already says so.
    }
  }, []);

  // The socket reconnects the instant a deploy replaces the server, so that is
  // the fastest truthful moment to compare builds (UX-34).
  useEffect(() => {
    registerBuildCheck(() => void check());
    return () => registerBuildCheck(null);
  }, [check]);

  /**
   * No timer. The check runs on load, when the tab comes back into view, when
   * the network returns, and on every realtime reconnect — which is what a
   * deploy actually produces (UX-34).
   */
  useEffect(() => {
    void check();
    const onWake = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [check]);

  // Leave no `?build=` trail behind once the new build is actually running.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("build")) return;
    const local = runningBuild();
    if (!local || url.searchParams.get("build") === local) {
      url.searchParams.delete("build");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  useEffect(() => {
    if (!incoming) return;
    let cancelled = false;
    const stuckTimer = window.setTimeout(() => setStuck(true), STUCK_MS);

    const adopt = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, SPLASH_MS));
      if (cancelled) return;
      // Ask the service worker for fresh copies first, so the reload cannot be
      // answered from a cache that predates the new build.
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => registration.update().catch(() => undefined)),
        );
      }
      if (cancelled) return;
      const url = new URL(window.location.href);
      url.searchParams.set("build", incoming);
      window.location.replace(url.toString());
    };

    void adopt();
    return () => {
      cancelled = true;
      window.clearTimeout(stuckTimer);
    };
  }, [incoming]);

  const reloadNow = () => {
    const url = new URL(window.location.href);
    if (incoming) url.searchParams.set("build", incoming);
    window.location.replace(url.toString());
  };

  if (!incoming) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-[100] grid place-items-center bg-canvas px-6"
    >
      <div className="w-full max-w-xs text-center">
        <span aria-hidden className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-raised ring-1 ring-edge">
          <span className="flex flex-col gap-[3px]">
            <span className="h-[2px] w-5 rounded-full bg-accent" />
            <span className="h-[2px] w-3.5 rounded-full bg-accent/80" />
            <span className="h-[2px] w-2 rounded-full bg-accent/60" />
          </span>
        </span>

        <p className="mt-5 text-base font-medium text-ink">Shipping the newest build</p>
        <p className="mt-1.5 text-sm text-muted">
          A new version is live. This page is loading it now — anything you typed is already saved on
          this device.
        </p>
        <p className="mt-4 font-mono text-[11px] text-muted">
          {runningBuild()} → {incoming}
        </p>

        {stuck && (
          <button
            type="button"
            onClick={reloadNow}
            className="ds-button ds-button-primary mt-5 min-h-11 px-4 text-xs"
          >
            Reload now
          </button>
        )}
      </div>
    </div>
  );
}
