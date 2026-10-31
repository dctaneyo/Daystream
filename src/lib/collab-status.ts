import type { ConnectionStatus } from "@/lib/presence";

/**
 * Module-level connection status shared by every room the browser opens.
 *
 * Each day and note is a separate Yjs room with its own socket, so navigating
 * between them mounts a new provider whose first honest state is "connecting".
 * Without this store the pill would restart at "Connecting…" on every route
 * change even though the app never lost its connection. The store lets the new
 * room inherit the previous reading until it either syncs or fails.
 */
let current: ConnectionStatus = "connecting";

export function sharedStatus(): ConnectionStatus {
  return current;
}

export function rememberStatus(next: ConnectionStatus): void {
  current = next;
}
