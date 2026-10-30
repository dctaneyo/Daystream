import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { isSixDigits, LOCK_MINUTES, MAX_FAILED_ATTEMPTS } from "@/lib/pin";

export type PinUser = {
  id: string;
  publicId: string;
  name: string;
  email: string | null;
  isAdmin: boolean;
};

type PinRow = {
  id: string;
  public_id: string;
  name: string | null;
  email: string | null;
  pin_hash: string | null;
  is_admin: boolean;
  status: string;
  failed_attempts: number;
  locked_until: Date | null;
};

export type PinAuthResult =
  | { ok: true; user: PinUser }
  | { ok: false; reason: "invalid" | "locked" | "suspended"; retryAfterSeconds?: number };

// Compared against when the ID doesn't exist, so a miss costs the same as a bad PIN.
const DUMMY_HASH = "$2b$10$C6UzMDM.H6dfI/f/IKcEe.9LZn5u1pM0aQKkN9dXyMwHg7rU4B/8u";

function lockSeconds(lockedUntil: Date | null): number {
  if (!lockedUntil) return 0;
  return Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
}

export async function authenticateWithPin(publicId: string, pin: string): Promise<PinAuthResult> {
  if (!isSixDigits(publicId) || !isSixDigits(pin)) return { ok: false, reason: "invalid" };

  const { rows } = await query<PinRow>(
    `SELECT id, public_id, name, email, pin_hash, is_admin, status, failed_attempts, locked_until
       FROM users
      WHERE public_id = $1`,
    [publicId],
  );
  const row = rows[0];

  if (!row) {
    await bcrypt.compare(pin, DUMMY_HASH);
    return { ok: false, reason: "invalid" };
  }

  if (row.status !== "active") {
    return { ok: false, reason: "suspended" };
  }

  const remaining = lockSeconds(row.locked_until);
  if (remaining > 0) {
    return { ok: false, reason: "locked", retryAfterSeconds: remaining };
  }

  if (!row.pin_hash) {
    await bcrypt.compare(pin, DUMMY_HASH);
    return { ok: false, reason: "invalid" };
  }

  const matches = await bcrypt.compare(pin, row.pin_hash);
  if (!matches) {
    const attempts = row.failed_attempts + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
    await query(
      `UPDATE users
          SET failed_attempts = $2,
              locked_until = CASE WHEN $3 THEN now() + ($4 || ' minutes')::interval ELSE locked_until END
        WHERE id = $1`,
      [row.id, attempts, shouldLock, String(LOCK_MINUTES)],
    );
    if (shouldLock) {
      return { ok: false, reason: "locked", retryAfterSeconds: LOCK_MINUTES * 60 };
    }
    return { ok: false, reason: "invalid" };
  }

  await query(
    `UPDATE users
        SET failed_attempts = 0, locked_until = NULL, last_login_at = now()
      WHERE id = $1`,
    [row.id],
  );

  return {
    ok: true,
    user: {
      id: row.id,
      publicId: row.public_id,
      name: row.name ?? `User ${row.public_id}`,
      email: row.email,
      isAdmin: row.is_admin,
    },
  };
}

/** Read-only lock/status lookup so the login screen can explain a failure. */
export async function getLoginState(
  publicId: string,
): Promise<{ suspended: boolean; lockedSeconds: number }> {
  if (!isSixDigits(publicId)) return { suspended: false, lockedSeconds: 0 };
  const { rows } = await query<{ status: string; locked_until: Date | null }>(
    "SELECT status, locked_until FROM users WHERE public_id = $1",
    [publicId],
  );
  const row = rows[0];
  if (!row) return { suspended: false, lockedSeconds: 0 };
  return { suspended: row.status !== "active", lockedSeconds: lockSeconds(row.locked_until) };
}
