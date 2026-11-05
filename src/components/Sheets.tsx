import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import { todayKey } from "../lib/dates";
import { authMessage } from "../lib/errors";
import { useSession } from "../lib/session";
import { ACCENTS, THEMES, useAppearance } from "../lib/theme";
import type {
  Member,
  NoteShares,
  NoteSummary,
  Template,
  Workspace,
} from "../types";
import { MonthCalendar } from "./MonthCalendar";

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    document.body.classList.add("ds-no-scroll");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("ds-no-scroll");
    };
  }, [onClose]);

  return (
    <div
      className="ds-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="ds-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="ds-sheet-head">
          <h2 className="ds-sheet-title">{title}</h2>
          <button type="button" className="ds-text-btn" ref={closeRef} onClick={onClose}>
            Close
          </button>
        </header>
        <div className="ds-sheet-body">{children}</div>
      </section>
    </div>
  );
}

/* --------------------------------- account -------------------------------- */

export function SettingsSheet({ onClose }: { onClose(): void }) {
  const session = useSession();
  const { theme, accent, dark, setTheme, setAccent } = useAppearance();
  const [copied, setCopied] = useState(false);
  const [signOutArmed, setSignOutArmed] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(session.me?.user.displayName ?? "");
  const [nameError, setNameError] = useState("");
  const [nameBusy, setNameBusy] = useState(false);

  const userId = session.me?.user.userId ?? "";

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = nameDraft.replace(/\s+/g, " ").trim();
    if (next.length < 2) {
      setNameError("Enter your name.");
      return;
    }
    setNameBusy(true);
    setNameError("");
    try {
      await session.rename(next);
      setNameOpen(false);
    } catch (caught) {
      setNameError(authMessage(caught));
    } finally {
      setNameBusy(false);
    }
  };

  return (
    <Sheet title="Account" onClose={onClose}>
      <section className="ds-section">
        <h3 className="ds-eyebrow">Appearance</h3>
        <div className="ds-choice-row" role="group" aria-label="Theme">
          {THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`ds-choice ${theme === option.id ? "is-active" : ""}`}
              aria-pressed={theme === option.id}
              onClick={() => setTheme(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="ds-choice-row" role="group" aria-label="Accent">
          {ACCENTS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="ds-swatch"
              style={{ background: dark ? option.dark : option.light }}
              aria-pressed={accent === option.id}
              aria-label={option.label}
              onClick={() => setAccent(option.id)}
            />
          ))}
        </div>
      </section>

      <section className="ds-section">
        <h3 className="ds-eyebrow">You</h3>
        <div>
          <p className="ds-settings-name">{session.me?.user.displayName}</p>
          <p className="ds-settings-id">{userId}</p>
        </div>

        {nameOpen ? (
          <form className="ds-name-form" onSubmit={(event) => void saveName(event)}>
            <label className="ds-label" htmlFor="account-display-name">
              Display name
            </label>
            <input
              id="account-display-name"
              className="ds-input"
              autoFocus
              autoComplete="name"
              autoCapitalize="words"
              maxLength={60}
              value={nameDraft}
              onChange={(event) => {
                setNameDraft(event.target.value);
                setNameError("");
              }}
            />
            <div className="ds-form-row">
              <button
                type="submit"
                className="ds-primary"
                disabled={nameBusy || nameDraft.trim().length < 2}
              >
                Save name
              </button>
              <button
                type="button"
                className="ds-text-btn"
                onClick={() => {
                  setNameOpen(false);
                  setNameDraft(session.me?.user.displayName ?? "");
                  setNameError("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {nameError ? (
          <p className="ds-inline-note" role="alert">
            {nameError}
          </p>
        ) : null}

        <div className="ds-action-list">
          <button type="button" className="ds-text-btn" onClick={() => void copyId()}>
            {copied ? "Copied" : "Copy ID"}
          </button>
          <button
            type="button"
            className="ds-text-btn"
            onClick={() => {
              setNameDraft(session.me?.user.displayName ?? "");
              setNameError("");
              setNameOpen((open) => !open);
            }}
          >
            {nameOpen ? "Close name editor" : "Change name"}
          </button>
          <button type="button" className="ds-text-btn" onClick={session.lock}>
            Lock now
          </button>
          {session.me?.user.isAdmin ? (
            <a className="ds-text-btn" href="/admin">
              Admin console
            </a>
          ) : null}
          <button
            type="button"
            className="ds-text-btn ds-danger ds-action-danger"
            onClick={() => {
              if (!signOutArmed) {
                setSignOutArmed(true);
                return;
              }
              void session.signOut();
            }}
          >
            {signOutArmed ? "Tap again to sign out" : "Sign out"}
          </button>
        </div>
      </section>

      <p className="ds-settings-footnote">
        One day at a time. Your ID and PIN are the only way back in.
      </p>
    </Sheet>
  );
}

/* -------------------------------- workspace ------------------------------- */

interface WorkspaceProps {
  workspace: Workspace | null;
  workspaces: Workspace[];
  members: Member[];
  activeWorkspaceId: string;
  onClose(): void;
  onWorkspaceChange(id: string): void;
  onChanged(): void;
}

export function WorkspaceSheet({
  workspace,
  workspaces,
  members,
  activeWorkspaceId,
  onClose,
  onWorkspaceChange,
  onChanged,
}: WorkspaceProps) {
  const session = useSession();
  const [inviteId, setInviteId] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteNote, setInviteNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  const userId = session.me?.user.userId ?? "";

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspace) return;
    setBusy(true);
    setInviteNote("");
    try {
      const added = await api<Member>(`/workspaces/${workspace.id}/members`, {
        method: "POST",
        json: { identifier: inviteId.trim(), role: inviteRole },
      });
      setInviteNote(`${added.displayName} now has access.`);
      setInviteId("");
      onChanged();
    } catch (error) {
      setInviteNote(authMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const createWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspaceName.trim()) return;
    setBusy(true);
    setInviteNote("");
    try {
      const created = await api<Workspace>("/workspaces", {
        method: "POST",
        json: { name: workspaceName.trim() },
      });
      setWorkspaceName("");
      onWorkspaceChange(created.id);
      onChanged();
    } catch (error) {
      setInviteNote(authMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Workspace" onClose={onClose}>
      <section className="ds-section">
        <h3 className="ds-eyebrow">Switch</h3>
        <div className="ds-choice-row" role="group" aria-label="Workspace">
          {workspaces.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`ds-choice ${entry.id === activeWorkspaceId ? "is-active" : ""}`}
              aria-pressed={entry.id === activeWorkspaceId}
              onClick={() => onWorkspaceChange(entry.id)}
            >
              {entry.name}
            </button>
          ))}
        </div>

        <h3 className="ds-eyebrow">People</h3>
        <ul className="ds-members">
          {members.map((member) => (
            <li key={member.userId} className="ds-member">
              <span className="ds-member-person">
                <span className="ds-member-name">{member.displayName}</span>
                <span className="ds-member-id">
                  {member.userId}
                  {member.userId === userId ? " (you)" : ""}
                </span>
              </span>
              <span className="ds-member-role">{member.role}</span>
            </li>
          ))}
        </ul>

        <form className="ds-form" onSubmit={invite}>
          <label className="ds-label" htmlFor="invite-id">
            Add someone by name or ID
          </label>
          <div className="ds-form-row">
            <input
              id="invite-id"
              className="ds-input"
              autoComplete="off"
              maxLength={60}
              placeholder="Ada Lovelace or 663520"
              value={inviteId}
              onChange={(event) => setInviteId(event.target.value)}
            />
            <button
              type="submit"
              className="ds-text-btn"
              disabled={busy || !workspace || inviteId.trim().length < 2}
            >
              Add
            </button>
          </div>
          <div className="ds-choice-row" role="group" aria-label="New member role">
            <button
              type="button"
              className={`ds-choice ${inviteRole === "editor" ? "is-active" : ""}`}
              aria-pressed={inviteRole === "editor"}
              onClick={() => setInviteRole("editor")}
            >
              Editor
            </button>
            <button
              type="button"
              className={`ds-choice ${inviteRole === "viewer" ? "is-active" : ""}`}
              aria-pressed={inviteRole === "viewer"}
              onClick={() => setInviteRole("viewer")}
            >
              Viewer
            </button>
          </div>
        </form>

        <form className="ds-form" onSubmit={createWorkspace}>
          <label className="ds-label" htmlFor="workspace-name">
            New workspace
          </label>
          <div className="ds-form-row">
            <input
              id="workspace-name"
              className="ds-input"
              maxLength={80}
              placeholder="Name"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
            />
            <button type="submit" className="ds-text-btn" disabled={busy}>
              Create
            </button>
          </div>
        </form>

        {inviteNote ? (
          <p className="ds-inline-note" role="status">
            {inviteNote}
          </p>
        ) : null}
      </section>

      <p className="ds-settings-footnote">
        People added here see every note in this workspace. To share one note only, open it and
        use Share.
      </p>
    </Sheet>
  );
}

/* ------------------------------- note shares ------------------------------ */

export function NoteShareSheet({
  note,
  onClose,
  onChanged,
}: {
  note: NoteSummary;
  onClose(): void;
  onChanged(): void;
}) {
  const [data, setData] = useState<NoteShares | null>(null);
  const [failure, setFailure] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [armed, setArmed] = useState<string | null>(null);

  const load = async () => {
    try {
      setData(await api<NoteShares>(`/notes/${note.id}/shares`));
      setFailure("");
    } catch (error) {
      setFailure(authMessage(error));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifier.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const added = await api<Member>(`/notes/${note.id}/shares`, {
        method: "POST",
        json: { identifier: identifier.trim(), role: "editor" },
      });
      setMessage(`${added.displayName} can now edit this note.`);
      setIdentifier("");
      onChanged();
      await load();
    } catch (error) {
      setMessage(authMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: string) => {
    if (armed !== userId) {
      setArmed(userId);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api(`/notes/${note.id}/shares/${userId}`, { method: "DELETE" });
      setArmed(null);
      setMessage("Removed.");
      onChanged();
      await load();
    } catch (error) {
      setMessage(authMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Share note" onClose={onClose}>
      {failure ? <p className="ds-inline-note">{failure}</p> : null}
      {!data && !failure ? <p className="ds-inline-note">Loading…</p> : null}

      {data ? (
        <>
          <section className="ds-section">
            <h3 className="ds-eyebrow">In this workspace</h3>
            <ul className="ds-members">
              {data.members.map((member) => (
                <li key={member.userId} className="ds-member">
                  <span className="ds-member-person">
                    <span className="ds-member-name">{member.displayName}</span>
                    <span className="ds-member-id">{member.userId}</span>
                  </span>
                  <span className="ds-member-role">{member.role}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="ds-section">
            <h3 className="ds-eyebrow">Only this note</h3>
            {data.shares.length === 0 ? (
              <p className="ds-inline-note">
                Nobody outside this workspace can open this note.
              </p>
            ) : (
              <ul className="ds-members">
                {data.shares.map((share) => (
                  <li key={share.userId} className="ds-member">
                    <span className="ds-member-person">
                      <span className="ds-member-name">{share.displayName}</span>
                      <span className="ds-member-id">{share.userId}</span>
                    </span>
                    <button
                      type="button"
                      className="ds-text-btn ds-danger"
                      onClick={() => void remove(share.userId)}
                      disabled={busy}
                    >
                      {armed === share.userId ? "Tap again" : "Remove"}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form className="ds-form" onSubmit={invite}>
              <label className="ds-label" htmlFor="share-id">
                Add someone to this note
              </label>
              <div className="ds-form-row">
                <input
                  id="share-id"
                  className="ds-input"
                  autoComplete="off"
                  maxLength={60}
                  placeholder="Ada Lovelace or 663520"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                />
                <button
                  type="submit"
                  className="ds-text-btn"
                  disabled={busy || identifier.trim().length < 2}
                >
                  Add
                </button>
              </div>
            </form>

            {message ? (
              <p className="ds-inline-note" role="status">
                {message}
              </p>
            ) : null}
          </section>

          <p className="ds-settings-footnote">
            A note share opens this note only — not the workspace, its tray, or its other notes.
            They can edit the body, but cannot move or delete it.
          </p>
        </>
      ) : null}
    </Sheet>
  );
}

/* -------------------------------- calendar -------------------------------- */

export function CalendarSheet({
  date,
  onPick,
  onClose,
}: {
  date: string;
  onPick(date: string): void;
  onClose(): void;
}) {
  return (
    <Sheet title="Calendar" onClose={onClose}>
      <MonthCalendar
        date={date}
        onPick={(next) => {
          onPick(next);
          onClose();
        }}
      />

      <div className="ds-calendar-actions">
        <button
          type="button"
          className="ds-text-btn"
          onClick={() => {
            onPick(todayKey());
            onClose();
          }}
        >
          Today
        </button>
      </div>
    </Sheet>
  );
}

/* -------------------------------- templates ------------------------------- */

export function TemplatesSheet({
  templates,
  onPick,
  onClose,
  busy,
}: {
  templates: Template[];
  onPick(template: Template): void;
  onClose(): void;
  busy: boolean;
}) {
  return (
    <Sheet title="Templates" onClose={onClose}>
      {templates.length === 0 ? (
        <p className="ds-inline-note">No templates yet.</p>
      ) : (
        <ul className="ds-template-list">
          {templates.map((template) => (
            <li key={template.id} className="ds-template">
              <div className="ds-template-text">
                <span className="ds-template-title">{template.title}</span>
                <span className="ds-template-meta">
                  {template.blocks?.filter((block) => block.text).length ?? 0} starting lines
                </span>
              </div>
              <button
                type="button"
                className="ds-text-btn"
                onClick={() => onPick(template)}
                disabled={busy}
              >
                Start
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="ds-settings-footnote">
        Open a note and choose Save as template to add your own. A template seeds a new note; it
        never changes the template itself.
      </p>
    </Sheet>
  );
}
