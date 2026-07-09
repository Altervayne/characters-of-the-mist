/*
 * A remark plugin that allows ONLY a literal `<br>` / `<br/>` through as a real line break - the single raw-HTML
 * token a table cell needs (GFM has no other way to line-break inside a cell). Our note renderers deliberately
 * run NO `rehype-raw`, so any other inline HTML stays inert (rendered as literal text), keeping untrusted notes
 * safe. This narrows that gate to exactly `<br>`: it rewrites the matching mdast `html` node into a `break` node
 * (which react-markdown renders as `<br/>`); every other `html` node is left untouched.
 */

/** A minimal structural view of an mdast node (avoids a hard dependency on `@types/mdast`). */
interface MdNode {
   type: string;
   value?: string;
   children?: MdNode[];
}

/** Matches a lone `<br>` / `<br/>` / `<br />` html token (case-insensitive), and nothing else. */
const BR_ONLY = /^<br\s*\/?>$/i;

/** Replaces any `html` child that is exactly a `<br>` with a `break` node; recurses into the rest. */
function walk(node: MdNode): void {
   if (!node.children) return;
   for (const child of node.children) {
      if (child.type === 'html' && typeof child.value === 'string' && BR_ONLY.test(child.value.trim())) {
         // Turn the raw `<br>` into a semantic break; drop the raw value so nothing HTML-ish survives.
         child.type = 'break';
         delete child.value;
      } else {
         walk(child);
      }
   }
}

export function remarkLineBreaks() {
   return (tree: MdNode): void => {
      walk(tree);
   };
}
