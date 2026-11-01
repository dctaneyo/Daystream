/**
 * A single-slot toast queue. One message at a time is deliberate: an undo offer
 * competes with nothing, and a stack of banners is how people learn to ignore
 * them.
 */
export type ToastAction = { label: string; run: () => void };

export type ToastMessage = {
  id: number;
  message: string;
  tone: "neutral" | "error";
  action?: ToastAction;
};

type Listener = (toast: ToastMessage | null) => void;

const DURATION = 8000;

let current: ToastMessage | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(current);
}

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

export function dismissToast() {
  if (!current) return;
  current = null;
  clearTimer();
  emit();
}

export function showToast(input: {
  message: string;
  tone?: ToastMessage["tone"];
  action?: ToastAction;
}) {
  current = {
    id: nextId++,
    message: input.message,
    tone: input.tone ?? "neutral",
    action: input.action,
  };
  clearTimer();
  timer = setTimeout(dismissToast, DURATION);
  emit();
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
