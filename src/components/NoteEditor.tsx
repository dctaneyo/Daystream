import { Extension } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import { api } from "../lib/api";
import { openNoteSession, type NoteSession } from "../lib/collab";
import { authMessage } from "../lib/errors";
import { awarenessUser } from "../lib/presence";
import { useSession } from "../lib/session";
import type { AwarenessUser, NoteSummary, PinMode } from "../types";

const PIN_OPTIONS: { mode: PinMode; label: string }[] = [
  { mode: "none", label: "Free" },
  { mode: "day", label: "First today" },
  { mode: "global", label: "Held" },
];

type IndentNode = "taskItem" | "listItem";

function indentNode(editor: Editor): IndentNode | null {
  if (editor.isActive("taskItem")) return "taskItem";
  if (editor.isActive("listItem")) return "listItem";
  return null;
}

/*
 * Keyboard twins for the two editor capabilities the specification calls out:
 * Tab/Shift-Tab indentation, and the escape clause where return on an empty
 * checkbox turns it back into a plain paragraph instead of adding another box.
 */
const IndentExtension = Extension.create({
  name: "daystreamIndent",
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const node = indentNode(this.editor);
        if (!node) return false;
        return this.editor.commands.sinkListItem(node);
      },
      "Shift-Tab": () => {
        const node = indentNode(this.editor);
        if (!node) return false;
        return this.editor.commands.liftListItem(node);
      },
      Enter: () => {
        const editor = this.editor;
        if (!editor.isActive("taskItem")) return false;
        const { $from } = editor.state.selection;
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          const node = $from.node(depth);
          if (node.type.name !== "taskItem") continue;
          if (node.textContent.trim().length > 0) return false;
          return editor.chain().focus().toggleTaskList().run();
        }
        return false;
      },
    };
  },
});

function firstLine(text: string): string {
  return (
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ""
  );
}

export function NoteEditor({
  note,
  onClose,
  onChanged,
}: {
  note: NoteSummary;
  onClose(): void;
  onChanged(): void;
}) {
  const session = useSession();
  const user = useMemo(
    () => awarenessUser(session.me?.user.userId ?? "000000"),
    [session.me?.user.userId],
  );

  const [connection, setConnection] = useState<NoteSession | null>(null);
  const [failure, setFailure] = useState("");
  const [pinMode, setPinMode] = useState<PinMode>(note.pinMode);
  const [liveTitle, setLiveTitle] = useState(note.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPinMode(note.pinMode);
  }, [note.pinMode]);

  useEffect(() => {
    let cancelled = false;
    let opened: NoteSession | null = null;

    openNoteSession(note.id, user)
      .then((next) => {
        if (cancelled) {
          next.destroy();
          return;
        }
        opened = next;
        setConnection(next);
      })
      .catch((caught) => {
        setFailure(authMessage(caught));
      });

    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [note.id, user]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleTitle = useCallback((title: string) => {
    setLiveTitle(title);
  }, []);

  const changePin = async (mode: PinMode) => {
    if (busy || mode === pinMode) return;
    const previous = pinMode;
    setPinMode(mode);
    setBusy(true);
    setError("");
    try {
      await api(`/notes/${note.id}`, { method: "PATCH", json: { pinMode: mode } });
      onChanged();
    } catch (caught) {
      setPinMode(previous);
      setError(authMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/notes/${note.id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (caught) {
      setError(authMessage(caught));
      setBusy(false);
    }
  };

  return (
    <section className="ds-editor" role="dialog" aria-modal="true" aria-label="Note">
      <header className="ds-editor-head">
        <button type="button" className="ds-text-btn" onClick={onClose}>
          Day
        </button>
        <span className="ds-editor-title">{liveTitle || "Untitled"}</span>
        <button type="button" className="ds-text-btn" onClick={onClose}>
          Done
        </button>
      </header>

      <div className="ds-pin-row" role="group" aria-label="Pinning">
        <span className="ds-pin-label">Pin</span>
        {PIN_OPTIONS.map((option) => (
          <button
            key={option.mode}
            type="button"
            className={`ds-pin-choice ${pinMode === option.mode ? "is-active" : ""}`}
            aria-pressed={pinMode === option.mode}
            onClick={() => void changePin(option.mode)}
            disabled={busy}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="ds-pin-hint">
        Held notes sit above every date. First today tops this date only.
      </p>

      <div className="ds-editor-scroll">
        {connection ? (
          <NoteBody
            connection={connection}
            user={user}
            onTitle={handleTitle}
            autoFocus={!note.excerpt && !note.title}
          />
        ) : failure ? (
          <p className="ds-inline-note" role="alert">
            {failure}
          </p>
        ) : (
          <p className="ds-editor-loading">Opening…</p>
        )}

        <div className="ds-editor-danger">
          <button
            type="button"
            className="ds-text-btn ds-danger"
            onClick={() => void remove()}
            disabled={busy}
          >
            {confirmDelete ? "Tap again to delete" : "Delete note"}
          </button>
          {error ? <span className="ds-error-text">{error}</span> : null}
        </div>
      </div>
    </section>
  );
}

function NoteBody({
  connection,
  user,
  onTitle,
  autoFocus,
}: {
  connection: NoteSession;
  user: AwarenessUser;
  onTitle(title: string): void;
  autoFocus: boolean;
}) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          undoRedo: false,
          heading: { levels: [1, 2] },
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Placeholder.configure({
          placeholder: "Write. Try “- ”, “1. ”, “[] ” or “# ”.",
        }),
        Collaboration.configure({ document: connection.doc }),
        CollaborationCaret.configure({
          provider: connection.provider,
          user: { name: user.name, color: user.color },
        }),
        IndentExtension,
      ],
      editorProps: {
        attributes: {
          class: "ds-prose",
          "aria-label": "Note body",
          spellcheck: "true",
        },
      },
      autofocus: autoFocus ? "end" : false,
    },
    [connection],
  );

  const [peers, setPeers] = useState<AwarenessUser[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!editor) return;
    const update = () => onTitle(firstLine(editor.getText()));
    editor.on("update", update);
    update();
    return () => {
      editor.off("update", update);
    };
  }, [editor, onTitle]);

  useEffect(() => {
    const provider = connection.provider;
    const awareness = provider.awareness;

    const syncPeers = () => {
      const list: AwarenessUser[] = [];
      awareness?.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;
        const peer = state.user as AwarenessUser | undefined;
        if (peer) list.push(peer);
      });
      setPeers(list);
      setLive(Boolean(provider.isSynced));
    };

    const syncLive = () => setLive(Boolean(provider.isSynced));

    awareness?.on("change", syncPeers);
    provider.on("synced", syncLive);
    provider.on("connect", syncLive);
    provider.on("disconnect", syncLive);
    syncPeers();

    return () => {
      awareness?.off("change", syncPeers);
      provider.off("synced", syncLive);
      provider.off("connect", syncLive);
      provider.off("disconnect", syncLive);
    };
  }, [connection]);

  const swipe = useRef<{ x: number; y: number } | null>(null);

  if (!editor) {
    return <p className="ds-editor-loading">Editing…</p>;
  }

  const indent = () => {
    const node = indentNode(editor);
    if (node) editor.chain().focus().sinkListItem(node).run();
  };

  const outdent = () => {
    const node = indentNode(editor);
    if (node) editor.chain().focus().liftListItem(node).run();
  };

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (touch) swipe.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent) => {
    const start = swipe.current;
    swipe.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 64 && Math.abs(dy) < 40) {
      if (dx > 0) indent();
      else outdent();
    }
  };

  return (
    <div className="ds-editor-body" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <EditorContent editor={editor} />

      <div className="ds-editor-foot">
        <div className="ds-foot-group">
          <button type="button" className="ds-text-btn" onClick={outdent}>
            Outdent
          </button>
          <button type="button" className="ds-text-btn" onClick={indent}>
            Indent
          </button>
        </div>
        <span className="ds-foot-status">{live ? "Live" : "Saved on this device"}</span>
        <span className="ds-foot-peers">
          {peers.length === 0 ? (
            "Only you"
          ) : (
            <>
              {peers.slice(0, 3).map((peer) => (
                <span
                  key={peer.id}
                  className="ds-mark-dot ds-mark-dot--live"
                  style={{ background: peer.color }}
                  aria-hidden="true"
                />
              ))}
              {peers.length} here
            </>
          )}
        </span>
      </div>
    </div>
  );
}
