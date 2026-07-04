/*
 * Parses authored text (challenge flavor / consequences, notes) into segments, where a `{brace}` span is
 * a mention: `{name-tier}` is a status, anything else is a tag. Pure and framework-free - the renderer, the
 * remark plugin, and the tap-to-create round-trip all key off it. Braces are chosen so mentions coexist
 * with Markdown (which claims `[...]` for links); an unclosed `{` never matches, so malformed input renders
 * literally and nothing is swallowed.
 */

export type MentionSegment =
   | { type: 'text'; text: string }
   | { type: 'status'; name: string; tier: number; raw: string }
   | { type: 'tag'; name: string; raw: string };

/** A `{brace}` span with at least one non-`}` char inside; an unclosed `{` simply never matches. */
const MENTION_RE = /\{([^}]+)\}/g;
/** A status shape inside a brace: `name-tier` (a trailing `-<digits>`); anything else is a tag. */
const STATUS_RE = /^(.+)-(\d+)$/;

export function parseMentions(text: string): MentionSegment[] {
   const segments: MentionSegment[] = [];
   MENTION_RE.lastIndex = 0;
   let lastIndex = 0;
   let match: RegExpExecArray | null;

   while ((match = MENTION_RE.exec(text)) !== null) {
      if (match.index > lastIndex) {
         segments.push({ type: 'text', text: text.slice(lastIndex, match.index) });
      }
      const content = match[1];
      const statusMatch = STATUS_RE.exec(content);
      if (statusMatch) {
         segments.push({ type: 'status', name: statusMatch[1], tier: parseInt(statusMatch[2], 10), raw: content });
      } else {
         segments.push({ type: 'tag', name: content, raw: content });
      }
      lastIndex = MENTION_RE.lastIndex;
   }

   if (lastIndex < text.length) {
      segments.push({ type: 'text', text: text.slice(lastIndex) });
   }
   return segments;
}
