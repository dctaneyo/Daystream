import { idbDelete, idbGet, idbSet } from "./idb";

const PIN_ITERATIONS = 150_000;
const FAILURE_PREFIX = "daystream.unlockFailures";

export interface PinRecord {
  salt: string;
  hash: string;
  iterations: number;
}

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function derive(pin: string, salt: string, iterations: number): Promise<string> {
  if (!crypto.subtle) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations, hash: "SHA-256" },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

export async function rememberPin(userId: string, pin: string): Promise<void> {
  try {
    const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await derive(pin, salt, PIN_ITERATIONS);
    if (!hash) return;
    const record: PinRecord = { salt, hash, iterations: PIN_ITERATIONS };
    await idbSet(`pin.${userId}`, record);
  } catch {
    /* local resume is optional; server-side unlock still works */
  }
}

export const readPin = (userId: string) => idbGet<PinRecord>(`pin.${userId}`);

export async function verifyPin(record: PinRecord, pin: string): Promise<boolean> {
  const hash = await derive(pin, record.salt, record.iterations);
  if (!hash || hash.length !== record.hash.length) return false;
  let difference = 0;
  for (let index = 0; index < hash.length; index += 1) {
    difference |= hash.charCodeAt(index) ^ record.hash.charCodeAt(index);
  }
  return difference === 0;
}

export const clearPin = (userId: string) => idbDelete(`pin.${userId}`);

export function failedUnlocks(userId: string): number {
  try {
    return Number(sessionStorage.getItem(`${FAILURE_PREFIX}.${userId}`) ?? "0");
  } catch {
    return 0;
  }
}

export function noteFailedUnlock(userId: string): number {
  const next = failedUnlocks(userId) + 1;
  try {
    sessionStorage.setItem(`${FAILURE_PREFIX}.${userId}`, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearFailedUnlocks(userId: string): void {
  try {
    sessionStorage.removeItem(`${FAILURE_PREFIX}.${userId}`);
  } catch {
    /* ignore */
  }
}
