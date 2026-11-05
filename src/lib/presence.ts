import type { AwarenessUser } from "../types";

// Muted, printable inks only — presence should read as pencil annotations, not
// as neon. Each is dark enough for white caret labels on the light canvas.
const INKS = ["#4A5D4E", "#4A5568", "#8C6239", "#742A2A", "#3F5B58", "#6B5B4A"];

export function awarenessUser(userId: string): AwarenessUser {
  const sum = [...userId].reduce((total, character) => total + character.charCodeAt(0), 0);
  return {
    id: userId,
    name: userId,
    color: INKS[sum % INKS.length] ?? INKS[0],
  };
}
