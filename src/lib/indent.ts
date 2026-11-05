import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";

export const MAX_BLOCK_INDENT = 6;

type IndentableNode = "paragraph" | "heading";
type ListIndentNode = "taskItem" | "listItem";

const INDENTABLE = new Set<IndentableNode>(["paragraph", "heading"]);

function clampIndent(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(MAX_BLOCK_INDENT, Math.round(number)));
}

export function indentNode(editor: Editor): ListIndentNode | null {
  // Walk the selection's actual ancestry instead of asking isActive(): a
  // multi-block selection or a just-converted list can leave isActive() false
  // even though the caret is structurally inside a list item. Falling through
  // to block indentation there writes data-indent onto list paragraphs instead
  // of nesting the list.
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (name === "taskItem") return "taskItem";
    if (name === "listItem") return "listItem";
  }
  return null;
}

/**
 * Every selected paragraph or heading is a block that can carry its own
 * indentation. This is deliberately separate from list nesting: lists stay
 * structurally nested, while ordinary lines can step in and out repeatedly.
 */
export function getIndentableBlocks(
  editor: Editor,
): { pos: number; indent: number }[] {
  const { state } = editor;
  const { from, to } = state.selection;
  const positions = new Set<number>();

  if (from === to) {
    const parent = state.selection.$from.parent;
    if (INDENTABLE.has(parent.type.name as IndentableNode)) {
      positions.add(state.selection.$from.before());
    }
  } else {
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (INDENTABLE.has(node.type.name as IndentableNode)) positions.add(pos);
    });
  }

  return [...positions]
    .map((pos) => ({
      pos,
      indent: clampIndent(state.doc.nodeAt(pos)?.attrs.indent),
    }))
    .filter((block) => {
      const node = state.doc.nodeAt(block.pos);
      return node !== null;
    });
}

export function canIndentSelection(editor: Editor): boolean {
  const listNode = indentNode(editor);
  if (listNode) return editor.can().sinkListItem(listNode);
  return getIndentableBlocks(editor).some(
    (block) => block.indent < MAX_BLOCK_INDENT,
  );
}

export function canOutdentSelection(editor: Editor): boolean {
  const listNode = indentNode(editor);
  if (listNode) return editor.can().liftListItem(listNode);
  return getIndentableBlocks(editor).some((block) => block.indent > 0);
}

function changeBlockIndent(editor: Editor, direction: 1 | -1): boolean {
  const blocks = getIndentableBlocks(editor);
  if (!blocks.length) return false;

  const tr = editor.state.tr;
  for (const block of blocks) {
    const node = tr.doc.nodeAt(block.pos);
    if (!node) continue;
    const next = clampIndent(block.indent + direction);
    if (next === block.indent) continue;
    tr.setNodeMarkup(block.pos, undefined, { ...node.attrs, indent: next });
  }

  if (!tr.docChanged) return false;
  editor.view.dispatch(tr);
  editor.commands.focus();
  return true;
}

export function indentSelection(editor: Editor, direction: 1 | -1): boolean {
  const listNode = indentNode(editor);
  if (listNode) {
    return direction > 0
      ? editor.chain().focus().sinkListItem(listNode).run()
      : editor.chain().focus().liftListItem(listNode).run();
  }
  return changeBlockIndent(editor, direction);
}

/**
 * Change paragraph/heading type directly so attributes such as indentation are
 * not reset by Tiptap's block-type command.
 */
export function setBlockType(
  editor: Editor,
  typeName: IndentableNode,
  attributes: Record<string, unknown> = {},
): boolean {
  const blocks = getIndentableBlocks(editor);
  if (!blocks.length) return false;
  const type = editor.schema.nodes[typeName];
  if (!type) return false;

  const tr = editor.state.tr;
  for (const block of blocks) {
    const node = tr.doc.nodeAt(block.pos);
    if (!node) continue;
    tr.setNodeMarkup(block.pos, type, { ...node.attrs, ...attributes });
  }

  if (!tr.docChanged) return false;
  editor.view.dispatch(tr);
  editor.commands.focus();
  return true;
}

export function toggleHeadingBlock(editor: Editor, level: 1 | 2): boolean {
  const active = editor.isActive("heading", { level });
  return setBlockType(
    editor,
    active ? "paragraph" : "heading",
    active ? {} : { level },
  );
}

export const IndentExtension = Extension.create({
  name: "daystreamIndent",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => clampIndent(element.getAttribute("data-indent")),
            renderHTML: (attributes) => {
              const indent = clampIndent(attributes.indent);
              return indent ? { "data-indent": String(indent) } : {};
            },
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const handles =
          indentNode(this.editor) !== null ||
          getIndentableBlocks(this.editor).length > 0;
        indentSelection(this.editor, 1);
        // Consume Tab even at the indent ceiling so the browser cannot move
        // focus out of the note instead of leaving the block where it is.
        return handles;
      },
      "Shift-Tab": () => {
        const handles =
          indentNode(this.editor) !== null ||
          getIndentableBlocks(this.editor).length > 0;
        indentSelection(this.editor, -1);
        return handles;
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
