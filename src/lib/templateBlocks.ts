import type { TemplateBlock } from "../types";

interface JsonNode {
  type?: string;
  text?: string;
  content?: JsonNode[];
}

function textOf(node: JsonNode | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(textOf).join("");
}

function firstParagraph(item: JsonNode): JsonNode | undefined {
  return item.content?.find((child) => child.type === "paragraph");
}

/**
 * Templates are deliberately flat: one block per line of structure. A nested
 * list is flattened to its visible order, which is what a template can seed
 * without carrying marks or arbitrary node types into the server.
 */
export function docToBlocks(doc: { content?: JsonNode[] }): TemplateBlock[] {
  const blocks: TemplateBlock[] = [];
  const push = (type: TemplateBlock["type"], text: string) => {
    if (blocks.length >= 200) return;
    blocks.push({ type, text: text.replace(/\s+/g, " ").trim() });
  };

  const visit = (node: JsonNode) => {
    switch (node.type) {
      case "heading":
        push("h1", textOf(node));
        return;
      case "paragraph":
      case "codeBlock":
        push("p", textOf(node));
        return;
      case "bulletList":
      case "orderedList":
        for (const item of node.content ?? []) {
          push("bullet", textOf(firstParagraph(item) ?? item));
        }
        return;
      case "taskList":
        for (const item of node.content ?? []) {
          push("check", textOf(item));
        }
        return;
      case "blockquote":
        push("quote", textOf(node));
        return;
      case "horizontalRule":
        return;
      default:
        for (const child of node.content ?? []) visit(child);
    }
  };

  for (const node of doc.content ?? []) visit(node);
  return blocks;
}
