const PRESENCE_COLORS = [
  "#7c8cff",
  "#4fd1c5",
  "#f6ad55",
  "#f687b3",
  "#9f7aea",
  "#68d391",
  "#f56565",
];

/** Stable per-user presence colour so avatars don't flicker between reloads. */
export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) % 100_000;
  }
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length] ?? PRESENCE_COLORS[0]!;
}
