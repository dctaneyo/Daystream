import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import { authMessage } from "../lib/errors";
import type { AdminUser, Me } from "../types";
import "./admin.css";

type Gate = "loading" | "signedOut" | "forbidden" | "ready";

interface UsersResponse {
  users: AdminUser[];
  viewer: { userId: string; isSuperAdmin: boolean };
}

function errorMessage(caught: unknown): string {
  if (caught instanceof ApiError) {
    if (caught.code === "forbidden") {
      return "Only the owner can change administrator access.";
    }
    if (caught.code === "cannot_change_owner") {
      return "The owner account cannot be changed here.";
    }
    if (caught.code === "cannot_change_self") {
      return "You cannot change your own ID.";
    }
  }
  return authMessage(caught);
}

function roleLabel(user: AdminUser): string {
  if (user.isSuperAdmin) return "Owner";
  if (user.isAdmin) return "Admin";
  return "Member";
}

/**
 * The console lives at its own address and renders outside the day shell, so
 * administration never adds chrome to the notebook. It reuses the same session
 * cookie and checks the account again on every management request.
 */
export default function AdminApp() {
  const [gate, setGate] = useState<Gate>("loading");
  const [viewer, setViewer] = useState<Me["user"] | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [armed, setArmed] = useState("");
  const [editing, setEditing] = useState("");
  const [nextId, setNextId] = useState("");
  const [editError, setEditError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<Me>("/me")
      .then((me) => {
        if (cancelled) return;
        setViewer(me.user);
        setGate(me.user.isAdmin ? "ready" : "forbidden");
      })
      .catch(() => {
        if (!cancelled) setGate("signedOut");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async (search: string) => {
    try {
      const payload = await api<UsersResponse>(
        `/admin/users?q=${encodeURIComponent(search)}`,
      );
      setUsers(payload.users);
      setError("");
      setLoaded(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setGate("signedOut");
        return;
      }
      setError(errorMessage(caught));
    }
  }, []);

  useEffect(() => {
    if (gate !== "ready") return;
    const timer = window.setTimeout(() => {
      void load(query.trim());
    }, 220);
    return () => window.clearTimeout(timer);
  }, [gate, query, load]);

  const changeRole = async (user: AdminUser) => {
    if (busy) return;
    const isAdmin = !user.isAdmin;
    if (!isAdmin && armed !== user.userId) {
      setArmed(user.userId);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/admin/users/${user.userId}/admin`, {
        method: "PATCH",
        json: { isAdmin },
      });
      setArmed("");
      await load(query.trim());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const saveId = async (event: FormEvent<HTMLFormElement>, user: AdminUser) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setEditError("");
    try {
      await api(`/admin/users/${user.userId}/id`, {
        method: "PATCH",
        json: { userId: nextId },
      });
      setEditing("");
      setNextId("");
      await load(query.trim());
    } catch (caught) {
      setEditError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (gate === "loading") {
    return (
      <main className="ds-admin-gate">
        <span className="ds-wordmark">DAYSTREAM</span>
      </main>
    );
  }

  if (gate === "signedOut") {
    return (
      <main className="ds-admin-gate">
        <span className="ds-wordmark">DAYSTREAM</span>
        <p className="ds-admin-gate-line">
          Administrators sign in through Daystream.
        </p>
        <a className="ds-primary" href="/">
          Open Daystream
        </a>
      </main>
    );
  }

  if (gate === "forbidden" || !viewer) {
    return (
      <main className="ds-admin-gate">
        <span className="ds-wordmark">DAYSTREAM</span>
        <p className="ds-admin-gate-line">This console is for administrators.</p>
        <a className="ds-text-btn" href="/">
          Back to Daystream
        </a>
      </main>
    );
  }

  return (
    <main className="ds-admin">
      <header className="ds-admin-head">
        <a className="ds-wordmark" href="/">
          DAYSTREAM
        </a>
        <div className="ds-admin-head-right">
          <span className="ds-eyebrow">Admin</span>
          <a className="ds-text-btn" href="/">
            Daystream
          </a>
        </div>
      </header>

      <section className="ds-admin-intro">
        <span className="ds-eyebrow">Accounts</span>
        <h1 className="ds-admin-title">People</h1>
        <p className="ds-admin-sub">
          {viewer.displayName} · {viewer.isSuperAdmin ? "Owner" : "Administrator"}
        </p>
      </section>

      <div className="ds-admin-tools">
        <input
          className="ds-input"
          aria-label="Search accounts"
          placeholder="Search by name or ID"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="ds-admin-count">
          {users.length} {users.length === 1 ? "account" : "accounts"}
        </span>
      </div>

      {error ? (
        <p className="ds-inline-note" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="ds-admin-list">
        {users.map((user) => {
          const isSelf = user.userId === viewer.userId;
          const canChangeRole =
            viewer.isSuperAdmin && !user.isSuperAdmin && !isSelf;
          const canEditId = !isSelf && (viewer.isSuperAdmin || !user.isAdmin);
          return (
            <li key={user.userId} className="ds-admin-row">
              <div className="ds-admin-person">
                <span className="ds-admin-name">{user.displayName}</span>
                <span className="ds-admin-meta">
                  ID {user.userId} · {roleLabel(user)}
                </span>
              </div>

              <div className="ds-admin-actions">
                {canChangeRole ? (
                  <button
                    type="button"
                    className="ds-text-btn"
                    disabled={busy}
                    onClick={() => void changeRole(user)}
                  >
                    {user.isAdmin
                      ? armed === user.userId
                        ? "Tap again to remove"
                        : "Remove admin"
                      : "Make admin"}
                  </button>
                ) : null}
                {canEditId ? (
                  <button
                    type="button"
                    className="ds-text-btn"
                    onClick={() => {
                      setEditing(editing === user.userId ? "" : user.userId);
                      setNextId("");
                      setEditError("");
                    }}
                  >
                    {editing === user.userId ? "Cancel" : "Change ID"}
                  </button>
                ) : null}
              </div>

              {editing === user.userId ? (
                <form className="ds-admin-edit" onSubmit={(event) => void saveId(event, user)}>
                  <label className="ds-label" htmlFor={`admin-id-${user.userId}`}>
                    New ID for {user.displayName}
                  </label>
                  <div className="ds-form-row">
                    <input
                      id={`admin-id-${user.userId}`}
                      className="ds-input"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      placeholder="6 digits"
                      value={nextId}
                      autoFocus
                      onChange={(event) =>
                        setNextId(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                    />
                    <button
                      type="submit"
                      className="ds-text-btn"
                      disabled={busy || nextId.length !== 6}
                    >
                      Save
                    </button>
                  </div>
                  <p className="ds-admin-hint">
                    Their current sessions end. They sign in with the new ID.
                  </p>
                  {editError ? <p className="ds-error-text">{editError}</p> : null}
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>

      {loaded && users.length === 0 ? (
        <p className="ds-admin-empty">No account matches that search.</p>
      ) : null}

      <p className="ds-admin-foot">
        Only the owner can make or remove administrators. Every administrator can
        change a member's six-digit ID.
      </p>
    </main>
  );
}
