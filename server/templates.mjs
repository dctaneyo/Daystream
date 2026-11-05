import * as Y from "yjs";

const BLOCK_TYPES = new Set(["p", "h1", "h2", "bullet", "check", "quote"]);
const HEADING_LEVEL = { h1: 1, h2: 2 };

export function structureBlocks(structure) {
  const raw = structure?.blocks;
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 200)
    .filter((block) => block && BLOCK_TYPES.has(block.type))
    .map((block) => ({
      type: block.type,
      text: typeof block.text === "string" ? block.text.slice(0, 2000) : "",
    }));
}

function paragraph(text) {
  const node = new Y.XmlElement("paragraph");
  if (text) node.insert(0, [new Y.XmlText(text)]);
  return node;
}

function xmlFor(block) {
  switch (block.type) {
    case "h1":
    case "h2": {
      const heading = new Y.XmlElement("heading");
      heading.setAttribute("level", HEADING_LEVEL[block.type]);
      if (block.text) heading.insert(0, [new Y.XmlText(block.text)]);
      return heading;
    }
    case "bullet": {
      const list = new Y.XmlElement("bulletList");
      const item = new Y.XmlElement("listItem");
      item.insert(0, [paragraph(block.text)]);
      list.insert(0, [item]);
      return list;
    }
    case "check": {
      const list = new Y.XmlElement("taskList");
      const item = new Y.XmlElement("taskItem");
      item.setAttribute("checked", false);
      item.insert(0, [paragraph(block.text)]);
      list.insert(0, [item]);
      return list;
    }
    case "quote": {
      const quote = new Y.XmlElement("blockquote");
      quote.insert(0, [paragraph(block.text)]);
      return quote;
    }
    default:
      return paragraph(block.text);
  }
}

/**
 * Templates are stored as plain node descriptors, so the server can build the
 * initial CRDT state without a browser or a ProseMirror schema. The seeded
 * nodes match the editor's schema exactly (heading levels, list wrappers).
 */
export function seedFromStructure(blocks) {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment("default");
  doc.transact(() => {
    for (const block of blocks) {
      fragment.insert(fragment.length, [xmlFor(block)]);
    }
  });
  const update = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return update;
}

export function summarizeStructure(blocks) {
  const lines = blocks
    .map((block) => block.text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return {
    title: (lines[0] ?? "").slice(0, 255),
    excerpt: lines.slice(1).join(" ").slice(0, 400),
  };
}

const TEXT_BLOCKS = new Set(["paragraph", "heading", "blockquote", "codeBlock"]);

function inlineText(node) {
  if (node instanceof Y.XmlText) return node.toString();
  if (node instanceof Y.XmlElement) {
    return node.toArray().map(inlineText).join("");
  }
  return "";
}

function collectLines(node, out) {
  if (node instanceof Y.XmlElement) {
    if (TEXT_BLOCKS.has(node.nodeName)) {
      out.push(inlineText(node));
      return;
    }
    for (const child of node.toArray()) collectLines(child, out);
    return;
  }
  if (node instanceof Y.XmlFragment) {
    for (const child of node.toArray()) collectLines(child, out);
  }
}

/** Derives the list projection (first line as title) from the live Yjs state. */
export function readNoteText(document) {
  const lines = [];
  collectLines(document.getXmlFragment("default"), lines);
  const clean = lines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  return {
    title: (clean[0] ?? "").slice(0, 255),
    excerpt: clean.slice(1).join(" ").slice(0, 400),
  };
}
