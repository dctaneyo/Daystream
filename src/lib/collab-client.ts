/** Browser-side helpers for opening a room. Shared by the canvas and the scratchpad. */

export function collabUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_COLLAB_URL;
  if (explicit) return explicit;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/collab`;
}

export async function fetchCollabToken(room: string): Promise<string> {
  const response = await fetch(`/api/collab-token?room=${encodeURIComponent(room)}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`collab token failed (${response.status})`);
  const data = (await response.json()) as { token?: string };
  if (!data.token) throw new Error("collab token missing");
  return data.token;
}
