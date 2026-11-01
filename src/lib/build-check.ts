type Listener = () => void;

let listener: Listener | null = null;

/**
 * BuildWatcher owns the check; the realtime layer calls it. A deploy kills the
 * WebSocket, so the reconnect is the earliest honest signal that a new build is
 * being served — sooner than any interval (UX-34).
 */
export function registerBuildCheck(next: Listener | null) {
  listener = next;
}

export function runBuildCheck() {
  listener?.();
}
