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
  type FormEvent,
} from "react";
import { api } from "../lib/api";
import { openNoteSession, type NoteSession } from "../lib/collab";
import { authMessage } from "../lib/errors";
import { awarenessUser } from "../lib/presence";
import { useSession } from "../lib/session";
import { docToBlocks } from "../lib/templateBlocks";
import type { AwarenessUser, NoteSummary, PinMode } from "../types";
import { Icon } from "./Icon";
import { NoteShareSheet } from "./Sheets";

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
  canManage = true,
}: {
  note: NoteSummary;
  onClose(): void;
  onChanged(): void;
  canManage?: boolean;
}) {
  const session = useSession();
  const user = useMemo(
    () =>
      awarenessUser(
        session.me?.user.userId ?? "000000",
        session.me?.user.displayName,
      ),
    [session.me?.user.userId, session.me?.user.displayName],
  );

  const [connection, setConnection] = useState<NoteSession | null>(null);
  const [failure, setFailure] = useState("");
  const [pinMode, setPinMode] = useState<PinMode>(note.pinMode);
  const [liveTitle, setLiveTitle] = useState(note.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [roomEpoch, setRoomEpoch] = useState(0);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateNote, setTemplateNote] = useState("");
  const [templateBusy, setTemplateBusy] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const shared = note.access === "shared";

  useEffect(() => {
    setPinMode(note.pinMode);
  }, [note.pinMode]);

  useEffect(() => {
    let cancelled = false;
    let opened: NoteSession | null = null;

    setFailure("");
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
  }, [note.id, user, roomEpoch]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // A nested sheet owns Escape while it is open; closing both surfaces at
      // once loses the note underneath it.
      if (event.key === "Escape" && !document.querySelector(".ds-overlay")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleTitle = useCallback((title: string) => {
    setLiveTitle(title);
  }, []);

  const handleEditor = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
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

  const saveTemplate = async (event: FormEvent) => {
    event.preventDefault();
    const editor = editorRef.current;
    if (!editor) return;
    const blocks = docToBlocks(editor.getJSON());
    if (!blocks.some((block) => block.text.trim())) {
      setTemplateNote("Write a line first.");
      return;
    }
    const title =
      templateTitle.trim() || firstLine(editor.getText()) || "Untitled template";
    setTemplateBusy(true);
    setTemplateNote("");
    try {
      await api("/templates", {
        method: "POST",
        json: { title, blocks },
      });
      setTemplateOpen(false);
      setTemplateNote("Saved as template.");
      onChanged();
    } catch (caught) {
      setTemplateNote(authMessage(caught));
    } finally {
      setTemplateBusy(false);
    }
  };

  useEffect(() => {
    document.body.classList.add("ds-editor-open");
    return () => document.body.classList.remove("ds-editor-open");
  }, []);

  return (
    <>
      <div className="ds-editor-backdrop" aria-hidden="true" />
      <section className="ds-editor" role="dialog" aria-modal="true" aria-label="Note">
      <header className="ds-editor-head">
        <button type="button" className="ds-text-btn" onClick={onClose}>
          <Icon name="arrow-left" />
          Day
        </button>
        <span className="ds-editor-title">{liveTitle || "Untitled"}</span>
        <div className="ds-editor-head-actions">
          {canManage ? (
            <button
              type="button"
              className="ds-text-btn"
              onClick={() => setShareOpen(true)}
            >
              <Icon name="share" />
              Share
            </button>
          ) : null}
          <button type="button" className="ds-text-btn" onClick={onClose}>
            <Icon name="check" />
            Done
          </button>
        </div>
      </header>

      {shared ? (
        <p className="ds-editor-shared">
          Shared with you. You can edit the body; the owner controls its date and sharing.
        </p>
      ) : null}

      {canManage ? (
        <>
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
        </>
      ) : null}

      <div className="ds-editor-scroll">
        {connection ? (
          <NoteBody
            connection={connection}
            user={user}
            onTitle={handleTitle}
            onEditor={handleEditor}
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
          {canManage ? (
            templateOpen ? (
              <form className="ds-template-save" onSubmit={(event) => void saveTemplate(event)}>
                <label className="ds-label" htmlFor="template-title">
                  Template name
                </label>
                <div className="ds-form-row">
                  <input
                    id="template-title"
                    className="ds-input"
                    maxLength={255}
                    value={templateTitle}
                    onChange={(event) => setTemplateTitle(event.target.value)}
                  />
                  <button type="submit" className="ds-text-btn" disabled={templateBusy}>
                    <Icon name="check" />
                    Save
                  </button>
                  <button
                    type="button"
                    className="ds-text-btn"
                    onClick={() => {
                      setTemplateOpen(false);
                      setTemplateNote("");
                    }}
                  >
                    <Icon name="x" />
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="ds-text-btn"
                onClick={() => {
                  setTemplateTitle(liveTitle || "");
                  setTemplateOpen(true);
                  setTemplateNote("");
                }}
                disabled={busy}
              >
                <Icon name="layout" />
                Save as template
              </button>
            )
          ) : null}

          {templateNote ? (
            <span className="ds-inline-note" role="status">
              {templateNote}
            </span>
          ) : null}

          {canManage ? (
            <button
              type="button"
              className="ds-text-btn ds-danger"
              onClick={() => void remove()}
              disabled={busy}
            >
              <Icon name="trash" />
              {confirmDelete ? "Tap again to delete" : "Delete note"}
            </button>
          ) : null}
          {error ? <span className="ds-error-text">{error}</span> : null}
        </div>
      </div>

      {shareOpen ? (
        <NoteShareSheet
          note={note}
          onClose={() => setShareOpen(false)}
          onChanged={() => {
            // Adding the first share switches the note from its private room to
            // the shared room. Reconnect so this editor is in the same room as
            // the person who just got access.
            setRoomEpoch((current) => current + 1);
            onChanged();
          }}
        />
      ) : null}
      </section>
    </>
  );
}

function NoteBody({
  connection,
  user,
  onTitle,
  onEditor,
  autoFocus,
}: {
  connection: NoteSession;
  user: AwarenessUser;
  onTitle(title: string): void;
  onEditor(editor: Editor | null): void;
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
  const [listNode, setListNode] = useState<IndentNode | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;
    onEditor(editor);
    return () => onEditor(null);
  }, [editor, onEditor]);

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
    if (!editor) return;
    const refresh = () => setListNode(indentNode(editor));
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    refresh();
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

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

  // A horizontal swipe indents or outdents the list line under the thumb. The
  // browser's native touch handling would otherwise begin a text selection or
  // page pan, so only a clearly horizontal gesture is captured.
  useEffect(() => {
    const element = bodyRef.current;
    if (!editor || !element) return;

    let start: { x: number; y: number } | null = null;
    let horizontal = false;

    const onStart = (event: globalThis.TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY };
      horizontal = false;
    };

    const onMove = (event: globalThis.TouchEvent) => {
      if (!start || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (!horizontal && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        horizontal = true;
      }
      if (horizontal && event.cancelable) event.preventDefault();
    };

    const onEnd = (event: globalThis.TouchEvent) => {
      const from = start;
      const swiped = horizontal;
      start = null;
      horizontal = false;
      if (!from || !swiped) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) < 64 || Math.abs(dy) > 48) return;
      const node = indentNode(editor);
      if (!node) return;
      if (dx > 0) editor.chain().focus().sinkListItem(node).run();
      else editor.chain().focus().liftListItem(node).run();
    };

    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: false });
    element.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
    };
  }, [editor]);

  if (!editor) {
    return <p className="ds-editor-loading">Editing…</p>;
  }

  const canIndent = Boolean(listNode && editor.can().sinkListItem(listNode));
  const canOutdent = Boolean(listNode && editor.can().liftListItem(listNode));

  const indent = () => {
    if (!listNode) return;
    editor.chain().focus().sinkListItem(listNode).run();
  };

  const outdent = () => {
    if (!listNode) return;
    editor.chain().focus().liftListItem(listNode).run();
  };

  return (
    <div className="ds-editor-body" ref={bodyRef}>
      <EditorContent editor={editor} />

      <div className="ds-editor-foot">
        <div className="ds-foot-group">
          <button
            type="button"
            className="ds-text-btn"
            onClick={outdent}
            disabled={!canOutdent}
          >
            <Icon name="outdent" />
            Outdent
          </button>
          <button
            type="button"
            className="ds-text-btn"
            onClick={indent}
            disabled={!canIndent}
          >
            <Icon name="indent" />
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
