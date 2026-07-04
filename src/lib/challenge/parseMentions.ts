/*
 * Parses a Challenge Card's authored text (flavor / consequences) into segments, where a `[bracket]` span
 * is a mention: `[name-tier]` is a status, anything else is a tag. Pure and framework-free - the renderer
 * (and, later, the tap-to-create round-trip) both key off it. An unclosed `[` never matches, so malformed
 * input renders literally and nothing is swallowed.
 */

export type MentionSegment =
   | { type: 'text'; text: string }
   | { type: 'status'; name: string; tier: number; raw: string }
   | { type: 'tag'; name: string; raw: string };

/** A `[bracket]` span with at least one non-`]` char inside; an unclosed `[` simply never matches. */
const BRACKET_RE = /\[([^\]]+)\]/g;
/** A status shape inside a bracket: `name-tier` (a trailing `-<digits>`); anything else is a tag. */
const STATUS_RE = /^(.+)-(\d+)$/;

export function parseMentions(text: string): MentionSegment[] {
   const segments: MentionSegment[] = [];
   BRACKET_RE.lastIndex = 0;
   let lastIndex = 0;
   let match: RegExpExecArray | null;

   while ((match = BRACKET_RE.exec(text)) !== null) {
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
      lastIndex = BRACKET_RE.lastIndex;
   }

   if (lastIndex < text.length) {
      segments.push({ type: 'text', text: text.slice(lastIndex) });
   }
   return segments;
}
