import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, refreshSession } from "./api";
import { authMessage } from "./errors";
import {
  clearFailedUnlocks,
  clearPin,
  noteFailedUnlock,
  readPin,
  rememberPin,
  verifyPin,
} from "./pin";
import type { Me } from "../types";

const IDLE_MS = 4 * 60 * 60 * 1000;
const LAST_ACTIVE_KEY = "daystream.lastActive";
const HIDDEN_KEY = "daystream.hiddenAt";
const UNLOCKED_KEY = "daystream.unlocked";

export type SessionStatus = "loading" | "signedOut" | "locked" | "ready";

export interface SessionValue {
  status: SessionStatus;
  me: Me | null;
  busy: boolean;
  message: string;
  signIn(userId: string, pin: string): Promise<void>;
  register(pin: string): Promise<{ userId: string }>;
  enter(): void;
  unlock(pin: string): Promise<void>;
  lock(): void;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

function markActive(): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function clearUnlockedMarker(): void {
  try {
    sessionStorage.removeItem(UNLOCKED_KEY);
  } catch {
    /* ignore */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const meRef = useRef<Me | null>(null);
  meRef.current = me;

  const lock = useCallback(() => {
    if (!meRef.current) return;
    clearUnlockedMarker();
    setMessage("");
    setStatus((current) => (current === "ready" ? "locked" : current));
  }, []);

  const hardSignOut = useCallback(async (reason: string) => {
    const userId = meRef.current?.user.userId;
    if (userId) await clearPin(userId);
    clearUnlockedMarker();
    setMe(null);
    setStatus("signedOut");
    setMessage(reason);
    void api("/auth/logout", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let next: Me | null = null;
      try {
        next = await api<Me>("/me");
      } catch {
        if (await refreshSession()) {
          try {
            next = await api<Me>("/me");
          } catch {
            next = null;
          }
        }
      }

      if (cancelled) return;
      if (!next) {
        setStatus("signedOut");
        return;
      }
      if (Date.now() > next.session.endsAt) {
        await hardSignOut("Your seven-day session ended. Sign in with your ID and PIN.");
        return;
      }

      setMe(next);

      // A reload inside the same foreground session resumes straight into the
      // day; every other entry point asks for the PIN only.
      let resumed = false;
      try {
        resumed = sessionStorage.getItem(UNLOCKED_KEY) === "1";
      } catch {
        resumed = false;
      }
      const record = resumed ? await readPin(next.user.userId) : null;
      setStatus(resumed && record ? "ready" : "locked");
    })().catch(() => {
      if (!cancelled) setStatus("signedOut");
    });

    return () => {
      cancelled = true;
    };
  }, [hardSignOut]);

  const signIn = useCallback(async (userId: string, pin: string) => {
    setBusy(true);
    setMessage("");
    try {
      await api("/auth/login", { method: "POST", json: { userId, pin } });
      await rememberPin(userId, pin);
      const next = await api<Me>("/me");
      setMe(next);
      try {
        sessionStorage.setItem(UNLOCKED_KEY, "1");
      } catch {
        /* ignore */
      }
      markActive();
      setStatus("ready");
    } catch (error) {
      setMessage(authMessage(error));
      throw error;
    } finally {
      setBusy(false);
    }
  }, []);

  const register = useCallback(async (pin: string) => {
    setBusy(true);
    setMessage("");
    try {
      const created = await api<{ user: { userId: string } }>("/auth/register", {
        method: "POST",
        json: { pin },
      });
      const next = await api<Me>("/me");
      await rememberPin(created.user.userId, pin);
      setMe(next);
      // Hold on the "write this down" screen until `enter()` is pressed.
      setStatus("signedOut");
      return { userId: created.user.userId };
    } catch (error) {
      setMessage(authMessage(error));
      throw error;
    } finally {
      setBusy(false);
    }
  }, []);

  const enter = useCallback(() => {
    try {
      sessionStorage.setItem(UNLOCKED_KEY, "1");
    } catch {
      /* ignore */
    }
    markActive();
    setStatus("ready");
  }, []);

  /**
   * The local PBKDF2 digest decides first, so a returning user resumes in the
   * time it takes to hash six digits instead of waiting on the network. The
   * server unlock still runs: it rotates the access token and is the only thing
   * that can extend the session past the seven-day wall.
   */
  const unlock = useCallback(
    async (pin: string) => {
      const current = meRef.current;
      if (!current) {
        setStatus("signedOut");
        return;
      }
      const userId = current.user.userId;
      setBusy(true);
      setMessage("");

      let localOk = false;
      try {
        const record = await readPin(userId);
        localOk = record ? await verifyPin(record, pin) : false;
      } catch {
        localOk = false;
      }

      if (localOk) {
        setStatus("ready");
        try {
          sessionStorage.setItem(UNLOCKED_KEY, "1");
        } catch {
          /* ignore */
        }
        markActive();
      }

      try {
        await api("/auth/unlock", { method: "POST", json: { pin } });
        const next = await api<Me>("/me");
        setMe(next);
        clearFailedUnlocks(userId);

        if (!localOk) {
          await rememberPin(userId, pin);
          setStatus("ready");
          try {
            sessionStorage.setItem(UNLOCKED_KEY, "1");
          } catch {
            /* ignore */
          }
          markActive();
        }
      } catch (error) {
        if (error instanceof ApiError && error.code === "invalid_credentials") {
          const failures = noteFailedUnlock(userId);
          setStatus("locked");
          clearUnlockedMarker();
          setMessage(
            failures >= 5
              ? "Too many attempts. Wait five minutes, then try again."
              : "That PIN didn't match.",
          );
        } else if (
          error instanceof ApiError &&
          (error.code === "session_expired" || error.code === "unauthenticated")
        ) {
          await hardSignOut("Your seven-day session ended. Sign in with your ID and PIN.");
        } else if (!localOk) {
          setStatus("locked");
          setMessage("You're offline. Reconnect once to unlock this device.");
        }
        // A matching local digest stays unlocked while the network is down.
      } finally {
        setBusy(false);
      }
    },
    [hardSignOut],
  );

  const signOut = useCallback(async () => {
    const userId = meRef.current?.user.userId;
    setBusy(true);
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* clearing local state is what matters */
    }
    if (userId) await clearPin(userId);
    clearUnlockedMarker();
    setMe(null);
    setMessage("");
    setStatus("signedOut");
    setBusy(false);
  }, []);

  /* Idle lock: four hours of no input, or four hours spent in the background. */
  useEffect(() => {
    if (status !== "ready") return;
    markActive();

    let lastWrite = 0;
    const mark = () => {
      const now = Date.now();
      if (now - lastWrite > 5000) {
        lastWrite = now;
        markActive();
      }
    };

    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "focus",
    ];
    events.forEach((event) => window.addEventListener(event, mark, { passive: true }));

    const onVisibility = () => {
      try {
        if (document.visibilityState === "hidden") {
          localStorage.setItem(HIDDEN_KEY, String(Date.now()));
          return;
        }
        const hiddenAt = Number(localStorage.getItem(HIDDEN_KEY) ?? 0);
        const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) ?? Date.now());
        if ((hiddenAt && Date.now() - hiddenAt > IDLE_MS) || Date.now() - last > IDLE_MS) {
          lock();
        } else {
          markActive();
        }
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const interval = window.setInterval(() => {
      const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) ?? Date.now());
      if (Date.now() - last > IDLE_MS) lock();
    }, 30_000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, mark));
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [status, lock]);

  const endsAt = me?.session.endsAt ?? 0;
  useEffect(() => {
    if (!endsAt || status === "signedOut") return;
    const check = () => {
      if (Date.now() > endsAt) {
        void hardSignOut("Your seven-day session ended. Sign in with your ID and PIN.");
      }
    };
    check();
    const interval = window.setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [endsAt, status, hardSignOut]);

  useEffect(() => {
    const onExpired = () => {
      // A signed-out visitor's first /me probe is not an expiry; only tear the
      // session down when there was a session to lose.
      if (!meRef.current) return;
      void hardSignOut("Your session ended. Sign in again.");
    };
    window.addEventListener("daystream:session-expired", onExpired);
    return () => window.removeEventListener("daystream:session-expired", onExpired);
  }, [hardSignOut]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      me,
      busy,
      message,
      signIn,
      register,
      enter,
      unlock,
      lock,
      signOut,
    }),
    [status, me, busy, message, signIn, register, enter, unlock, lock, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
