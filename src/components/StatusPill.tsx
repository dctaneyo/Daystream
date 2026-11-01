"use client";

import type { ConnectionStatus } from "@/lib/presence";

export type { ConnectionStatus };

const LABELS: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting… changes saved locally",
  offline: "Working offline",
};

const DOT: Record<ConnectionStatus, string> = {
  connecting: "bg-amber-400",
  connected: "bg-emerald-400",
  reconnecting: "bg-amber-400",
  offline: "bg-red-400",
};

export function StatusPill({
  status,
  peers,
}: {
  status: ConnectionStatus;
  peers: { id: number; name: string; color: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      {peers.length > 0 && (
        <div className="flex items-center -space-x-1.5" aria-label={`${peers.length} other people here`}>
          {peers.slice(0, 4).map((peer) => (
            <span
              key={peer.id}
              title={peer.name}
              style={{ backgroundColor: peer.color }}
              className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold text-black ring-2 ring-canvas"
            >
              {peer.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
          {peers.length > 4 && (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-raised text-[10px] text-muted ring-2 ring-canvas">
              +{peers.length - 4}
            </span>
          )}
        </div>
      )}
      <span
        className="flex items-center gap-1.5 rounded-full border border-edge bg-panel px-2.5 py-1 text-[11px] text-muted"
        role="status"
        aria-live="polite"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden />
        <span className="hidden sm:inline">{LABELS[status]}</span>
        <span className="sm:hidden">{status === "connected" ? "Synced" : status === "offline" ? "Offline" : "Local"}</span>
      </span>
    </div>
  );
}
