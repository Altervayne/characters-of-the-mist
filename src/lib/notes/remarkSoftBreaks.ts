/*
 * A remark plugin that renders a SINGLE newline as a hard line break, so Reading matches the Live editor
 * line-for-line. Markdown normally soft-JOINS adjacent lines within a paragraph (`a\nb` renders as one line),
 * but the CM6 Live editor shows each source line on its own visual line - so without this, typing two lines and
 * switching to Reading merges them, which reads as "the engine reinterpreted my text". This splits every text
 * node's interior `\n` into a `break` node (react-markdown renders `<br/>`); blank lines (`\n\n`) still separate
 * paragraphs (remark already split those into sibling blocks, so a text node's `\n` is always a soft break).
 * No new dependency - same tiny mdast walk as {@link import('./remarkLineBreaks').remarkLineBreaks}.
 */

/** A minimal structural view of an mdast node (avoids a hard dependency on `@types/mdast`). */
interface MdNode {
   type: string;
   value?: string;
   children?: MdNode[];
}

/** Splits any `text` child's interior `\n` into `break` nodes; recurses into the rest (code/inlineCode are leaves). */
function walk(node: MdNode): void {
   if (!node.children) return;
   const out: MdNode[] = [];
   for (const child of node.children) {
      if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('\n')) {
         const parts = child.value.split('\n');
         parts.forEach((part, i) => {
            if (i > 0) out.push({ type: 'break' });
            if (part) out.push({ type: 'text', value: part });
         });
      } else {
         walk(child);
         out.push(child);
      }
   }
   node.children = out;
}

export function remarkSoftBreaks() {
   return (tree: MdNode): void => {
      walk(tree);
   };
}
