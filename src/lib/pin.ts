import { randomInt } from "node:crypto";

/** Both the account ID and the PIN are exactly six digits. */
export const CODE_LENGTH = 6;
export const SIX_DIGITS = /^\d{6}$/;

export function isSixDigits(value: string): boolean {
  return SIX_DIGITS.test(value);
}

/** IDs start at 100000 so they always render as six digits. */
export function randomPublicId(): string {
  return String(randomInt(100_000, 1_000_000));
}

/** PINs allow a leading zero, so they are padded rather than floored. */
export function randomPin(): string {
  return String(randomInt(0, 1_000_000)).padStart(CODE_LENGTH, "0");
}

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 5;
