import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { query } from "./db.mjs";

const ISSUER = "daystream";
const AUDIENCE = "daystream-web";
export const ACCESS_COOKIE = "ds_at";
export const SESSION_COOKIE = "ds_rt";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACCESS_TTL_SECONDS = 15 * 60;
const PIN_ROUNDS = 11;

export function secretKey() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set to at least 16 characters.");
  }
  return new TextEncoder().encode(secret);
}

export function parseCookies(header = "") {
  const jar = new Map();
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    try {
      jar.set(name, decodeURIComponent(part.slice(index + 1).trim()));
    } catch {
      jar.set(name, part.slice(index + 1).trim());
    }
  }
  return jar;
}

function isSecure(req) {
  if (process.env.COOKIE_SECURE === "true") return true;
  const forwarded = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  return forwarded === "https" || req.protocol === "https";
}

function cookieBase(req, path) {
  return { httpOnly: true, sameSite: "lax", secure: isSecure(req), path };
}

async function sign(payload, seconds) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + Math.max(1, Math.floor(seconds)))
    .sign(secretKey());
}

/**
 * Issues the short-lived access token and the seven-day refresh token. Both are
 * HTTP-only. `session.startedAt` is carried in every token and is never moved
 * forward, so the seven-day wall is absolute: refreshing only ever shrinks the
 * remaining life, it cannot extend the session.
 */
export async function issueTokens(req, res, user, session) {
  const now = Date.now();
  const startedAt = session.startedAt ?? now;
  const endsAt = startedAt + SESSION_TTL_MS;
  const remaining = Math.floor((endsAt - now) / 1000);
  if (remaining <= 0) {
    const error = new Error("session_expired");
    error.code = "session_expired";
    throw error;
  }

  const sid = session.id || randomBytes(9).toString("base64url");
  const accessLifetime = Math.min(ACCESS_TTL_SECONDS, remaining);
  const claims = {
    sub: user.userId,
    adm: user.isAdmin === true,
    sid,
    sst: startedAt,
    typ: "access",
  };

  const access = await sign(claims, accessLifetime);
  const refresh = await sign({ ...claims, typ: "refresh" }, remaining);

  res.cookie(ACCESS_COOKIE, access, {
    ...cookieBase(req, "/"),
    maxAge: accessLifetime * 1000,
  });
  res.cookie(SESSION_COOKIE, refresh, {
    ...cookieBase(req, "/api/auth"),
    maxAge: remaining * 1000,
  });

  return { expiresAt: now + accessLifetime * 1000, endsAt };
}

export function clearSessionCookies(req, res) {
  res.clearCookie(ACCESS_COOKIE, cookieBase(req, "/"));
  res.clearCookie(SESSION_COOKIE, cookieBase(req, "/api/auth"));
}

async function readToken(cookieHeader, type) {
  const token = parseCookies(cookieHeader).get(
    type === "refresh" ? SESSION_COOKIE : ACCESS_COOKIE,
  );
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (payload.typ !== type || typeof payload.sub !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export const readRefresh = (req) => readToken(req.headers.cookie, "refresh");

export async function requireAuth(req, res, next) {
  const payload = await readToken(req.headers.cookie, "access");
  if (!payload?.sub) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  req.auth = {
    userId: String(payload.sub),
    isAdmin: payload.adm === true,
    sessionId: String(payload.sid ?? ""),
    sessionStartedAt: Number(payload.sst) || Date.now(),
  };
  next();
}

export function sameOrigin(req, res, next) {
  const site = req.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    res.status(403).json({ error: "cross_origin" });
    return;
  }
  next();
}

export const hashPin = (pin) => bcrypt.hash(pin, PIN_ROUNDS);
export const checkPin = (pin, hash) => bcrypt.compare(pin, hash);

let dummyHash = null;
export async function dummyPinHash() {
  dummyHash ??= await hashPin("000000");
  return dummyHash;
}

export async function findUser(userId) {
  const { rows } = await query(
    `SELECT user_id, pin_hash, display_name, is_admin, is_super_admin
       FROM users WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * Admin rights are re-read from Postgres on every management request, so a
 * promotion or demotion takes effect without waiting for a token refresh.
 */
export async function requireAdmin(req, res, next) {
  const user = await findUser(req.auth.userId);
  if (!user?.is_admin) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  req.auth.isAdmin = true;
  req.auth.isSuperAdmin = user.is_super_admin === true;
  next();
}

export function requireSuperAdmin(req, res, next) {
  if (req.auth?.isSuperAdmin !== true) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  next();
}

/*
 * Six digits is a million possibilities, so failed PINs are throttled in
 * memory per account. A restart clears the window; that is acceptable for a
 * single-service deployment and keeps the login path free of a DB write.
 */
const MAX_FAILURES = 6;
const LOCK_MS = 5 * 60 * 1000;
const failures = new Map();

export function throttleRemaining(key) {
  const entry = failures.get(key);
  if (!entry?.lockedUntil) return 0;
  const remaining = entry.lockedUntil - Date.now();
  if (remaining <= 0) {
    failures.delete(key);
    return 0;
  }
  return remaining;
}

export function recordFailure(key) {
  const entry = failures.get(key) ?? { count: 0, lockedUntil: 0 };
  const count = entry.count + 1;
  failures.set(key, {
    count,
    lockedUntil: count >= MAX_FAILURES ? Date.now() + LOCK_MS : 0,
  });
}

export function clearFailures(key) {
  failures.delete(key);
}
