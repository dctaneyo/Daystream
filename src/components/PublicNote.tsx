import Collaboration from "@tiptap/extension-collaboration";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { longDate } from "../lib/dates";
import { IndentExtension } from "../lib/indent";
import type { PublicNote as PublicNoteData } from "../types";

function decodeBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * The public page deliberately never enters SessionProvider or the collab
 * client. It is a separate read-only surface: one anonymous GET, one local Y.Doc,
 * no provider, no awareness, no editor commands.
 */
export function PublicNote({ token }: { token: string }) {
  const [data, setData] = useState<PublicNoteData | null>(null);
  const [failure, setFailure] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailure("");

    // Default same-origin credentials keep host-level preview auth working;
    // Daystream's public route itself never reads a session.
    fetch(`/api/public/notes/${encodeURIComponent(token)}`, {
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("not_found");
        return (await response.json()) as PublicNoteData;
      })
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch(() => {
        if (!cancelled) setFailure("This link is private or no longer available.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const doc = useMemo(() => {
    const next = new Y.Doc();
    if (data?.content) {
      try {
        Y.applyUpdate(next, decodeBytes(data.content));
      } catch {
        /* A malformed update leaves the page empty rather than crashing it. */
      }
    }
    return next;
  }, [data?.content]);

  useEffect(() => () => doc.destroy(), [doc]);

  const editor = useEditor(
    {
      editable: false,
      extensions: [
        StarterKit.configure({
          undoRedo: false,
          heading: { levels: [1, 2] },
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        IndentExtension,
        Collaboration.configure({ document: doc }),
      ],
      editorProps: {
        attributes: {
          class: "ds-prose ds-public-prose",
          "aria-label": "Note body",
          "aria-readonly": "true",
          spellcheck: "false",
        },
      },
    },
    [doc],
  );

  useEffect(() => {
    if (!data) return;
    document.title = `${data.note.title || "Untitled"} · Daystream`;
  }, [data]);

  return (
    <div className="ds-public">
      <header className="ds-public-head">
        <span className="ds-wordmark">DAYSTREAM</span>
        <span className="ds-public-readonly">Read only</span>
      </header>

      <main className="ds-public-body" aria-label="Shared note">
        {loading ? (
          <p className="ds-public-status">Opening…</p>
        ) : failure ? (
          <section className="ds-public-notice">
            <h1 className="ds-public-notice-title">Link unavailable</h1>
            <p>{failure}</p>
            <p>The person who shared it can turn the link back on.</p>
          </section>
        ) : data ? (
          <>
            <p className="ds-public-meta">
              <span>{data.note.workspaceName}</span>
              <span aria-hidden="true">·</span>
              <span>{longDate(data.note.assignedDate)}</span>
            </p>

            {data.content ? (
              <div className="ds-public-prose-wrap">
                <EditorContent editor={editor} />
              </div>
            ) : (
              <p className="ds-public-empty">This note is empty.</p>
            )}

            <footer className="ds-public-foot">
              <span>Shared as a read-only link.</span>
              <span>No account needed.</span>
            </footer>
          </>
        ) : null}
      </main>
    </div>
  );
}
