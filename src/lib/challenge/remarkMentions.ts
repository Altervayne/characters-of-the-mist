// -- Utils Imports --
import { parseMentions } from '@/lib/challenge/parseMentions';

/*
 * A remark plugin that turns `{brace}` mentions into a custom `mention` element in the Markdown tree, so a
 * status/tag pill can render natively inside formatted text (bold, lists, tables). It walks text nodes only,
 * so mentions inside code spans / fences (whose payload is a `value`, not child text nodes) are left literal.
 * The `mention` element carries the parsed fields as properties; the react-markdown `components` override
 * reads them back and renders the pill (interactive or plain). Reuses `parseMentions` so the brace grammar
 * lives in one place.
 */

/** A minimal structural view of an mdast node (avoids a hard dependency on `@types/mdast`). */
interface MdNode {
   type: string;
   value?: string;
   children?: MdNode[];
   data?: { hName?: string; hProperties?: Record<string, string> };
}

/** Builds the `mention` element node for a parsed status/tag segment. */
function mentionNode(type: 'status' | 'tag', name: string, raw: string, tier: number | null): MdNode {
   const label = type === 'status' ? `${name}-${tier}` : name;
   return {
      type: 'mention',
      data: {
         hName: 'mention',
         hProperties: { mentionType: type, mentionName: name, mentionRaw: raw, mentionTier: tier == null ? '' : String(tier) },
      },
      children: [{ type: 'text', value: label }],
   };
}

/** Splits one text node's value into text + mention nodes; returns the original node when it has no mention. */
function splitTextNode(value: string): MdNode[] {
   const segments = parseMentions(value);
   if (segments.length === 1 && segments[0].type === 'text') return [{ type: 'text', value }];
   return segments.map((segment) =>
      segment.type === 'text'
         ? { type: 'text', value: segment.text }
         : mentionNode(segment.type, segment.name, segment.raw, segment.type === 'status' ? segment.tier : null),
   );
}

/** Rewrites a node's children in place, expanding any text node that carries a `{brace}` mention. */
function walk(node: MdNode): void {
   if (!node.children) return;
   const next: MdNode[] = [];
   for (const child of node.children) {
      if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('{')) {
         next.push(...splitTextNode(child.value));
      } else {
         walk(child);
         next.push(child);
      }
   }
   node.children = next;
}

export function remarkMentions() {
   return (tree: MdNode): void => {
      walk(tree);
   };
}
