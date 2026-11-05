import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import { authMessage } from "../lib/errors";
import { useSession } from "../lib/session";
import { ACCENTS, THEMES, useAppearance } from "../lib/theme";
import type { Member, Template, Workspace } from "../types";

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

interface SettingsProps {
  workspace: Workspace | null;
  workspaces: Workspace[];
  members: Member[];
  activeWorkspaceId: string;
  onClose(): void;
  onWorkspaceChange(id: string): void;
  onChanged(): void;
}

export function SettingsSheet({
  workspace,
  workspaces,
  members,
  activeWorkspaceId,
  onClose,
  onWorkspaceChange,
  onChanged,
}: SettingsProps) {
  const session = useSession();
  const { theme, accent, dark, setTheme, setAccent } = useAppearance();
  const [copied, setCopied] = useState(false);
  const [signOutArmed, setSignOutArmed] = useState(false);
  const [inviteId, setInviteId] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteNote, setInviteNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

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

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspace) return;
    setBusy(true);
    setInviteNote("");
    try {
      await api(`/workspaces/${workspace.id}/members`, {
        method: "POST",
        json: { userId: inviteId, role: inviteRole },
      });
      setInviteNote(`${inviteId} now has access.`);
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
        <h3 className="ds-eyebrow">Your ID</h3>
        <p className="ds-settings-id">{userId}</p>
        <div className="ds-choice-row">
          <button type="button" className="ds-text-btn" onClick={() => void copyId()}>
            {copied ? "Copied" : "Copy ID"}
          </button>
          <button type="button" className="ds-text-btn" onClick={session.lock}>
            Lock now
          </button>
          <button
            type="button"
            className="ds-text-btn ds-danger"
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

      <section className="ds-section">
        <h3 className="ds-eyebrow">Workspace</h3>
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

        <ul className="ds-members">
          {members.map((member) => (
            <li key={member.userId} className="ds-member">
              <span className="ds-member-id">
                {member.userId}
                {member.userId === userId ? " (you)" : ""}
              </span>
              <span className="ds-member-role">{member.role}</span>
            </li>
          ))}
        </ul>

        <form className="ds-form" onSubmit={invite}>
          <label className="ds-label" htmlFor="invite-id">
            Add someone by ID
          </label>
          <div className="ds-form-row">
            <input
              id="invite-id"
              className="ds-input"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              placeholder="6 digits"
              value={inviteId}
              onChange={(event) =>
                setInviteId(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
            <button
              type="submit"
              className="ds-text-btn"
              disabled={busy || inviteId.length !== 6}
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
        Notes live inside a workspace. A held note follows you across every date; a first-of-day
        note tops its own date.
      </p>
    </Sheet>
  );
}

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
        A template seeds a new note. It never changes the template itself.
      </p>
    </Sheet>
  );
}
