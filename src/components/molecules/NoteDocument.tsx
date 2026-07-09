// -- Library Imports --
import { useMemo } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { remarkMentions } from '@/lib/challenge/remarkMentions';
import { remarkLineBreaks } from '@/lib/notes/remarkLineBreaks';
import { remarkSoftBreaks } from '@/lib/notes/remarkSoftBreaks';
import { separateTablesFromText } from '@/lib/notes/noteFormat';

// -- Component Imports --
import { docMarkdownComponents } from './markdown/docMarkdownComponents';
import { mentionComponents } from './markdown/markdownComponents';
import { NoteImage } from './note/NoteImage';
import { NoteCover } from './note/NoteCover';

// -- Type Imports --
import type { Components } from 'react-markdown';
import type { MentionSegment } from '@/lib/challenge/parseMentions';
import type { NoteCover as NoteCoverData } from '@/lib/types/board';

/*
 * The document Markdown renderer for a Note tab's PREVIEW (resting) state. It reuses the
 * remark + mention pipeline wholesale but at DOCUMENT scale via `docMarkdownComponents` (a
 * fork of the card prose map), and adds the reading measure cap - `max-w-[68ch]`, centered -
 * so lines don't run the full width of a wide monitor. `{brace}` mentions render as their
 * fixed-color pills; without `onMentionClick` they are plain, non-interactive labels.
 *
 * Inline images are the Note surface's OWN renderer ({@link NoteImage}): it resolves the `asset:`
 * scheme to a stored image and refuses any other (untrusted) src, keeping the shared doc map's
 * alt-text-only `img` intact for any non-note consumer. Raw HTML stays inert (no `rehype-raw`) EXCEPT a lone
 * `<br>`, narrowly allowed as a real line break via {@link remarkLineBreaks} (a table cell's only line break).
 * Links open in a new tab.
 *
 * The document TITLE renders as the leading H1 above the cover (matching `noteToMarkdown`'s `# {title}`), so
 * Reading shows the same title-over-cover layout the Live editor does.
 */

// The note-scoped `img` override, layered over the shared doc map (which stays alt-text-only).
const noteImageComponent: Partial<Components> = { img: NoteImage };

/*
 * react-markdown's default url sanitizer strips any non-http(s) scheme to empty, which would eat our
 * `asset:` image src before NoteImage ever sees it. Let ONLY `asset:` through untouched; everything else
 * still runs the default sanitizer (so http(s)/other schemes stay sanitized). NoteImage remains the real
 * safety gate - it renders an <img> for `asset:` alone and degrades any other src to alt text.
 */
function noteUrlTransform(url: string): string {
   return url.startsWith('asset:') ? url : defaultUrlTransform(url);
}

interface NoteDocumentProps {
   /** The document title; rendered as the leading H1 above the cover (mirrors the plain-markdown mapping). */
   title?: string;
   body: string;
   /** The note-level cover image; floated top-left so the opening text wraps beside it. */
   cover?: NoteCoverData;
   onMentionClick?: (segment: MentionSegment) => void;
   className?: string;
}

export function NoteDocument({ title, body, cover, onMentionClick, className }: NoteDocumentProps) {
   const components = useMemo(() => ({ ...docMarkdownComponents, ...noteImageComponent, ...mentionComponents(onMentionClick) }), [onMentionClick]);
   const heading = title?.trim();
   // Display-only: break a table off a text line one `\n` below it (GFM would else absorb the text as a cell).
   const renderedBody = useMemo(() => separateTablesFromText(body), [body]);
   // `[display:flow-root]` under a cover makes this a BFC so the floated cover is CONTAINED - the parchment
   // grows past a tall cover instead of the cover overflowing the sheet's bottom.
   return (
      <div className={cn('mx-auto w-full max-w-[68ch] text-base break-words', cover && 'note-cover-host [display:flow-root]', className)}>
         {/* The document title is the leading H1, ABOVE the cover (the cover floats after it, so the opening
             body wraps beside the cover, not the title). Matches `noteToMarkdown`'s `# {title}`. */}
         {heading ? <h1 className="mb-4 text-4xl font-bold text-paper-foreground">{heading}</h1> : null}
         {/* Cover floats before the body so the opening markdown flows beside it (magazine drop-cap). A leading
             heading in the body would normally `clear-both` below the float (that rule shields section breaks
             from inline images); under a cover host we neutralise it so the opening body heading wraps beside
             the cover, matching Live's gutter. In-text images are blocks now, so nothing else relies on it. */}
         {cover ? (
            <>
               <style>{'.note-cover-host > :is(h1,h2,h3,h4,h5,h6,hr){clear:none}'}</style>
               <NoteCover cover={cover} />
            </>
         ) : null}
         <ReactMarkdown remarkPlugins={[remarkGfm, remarkLineBreaks, remarkSoftBreaks, remarkMentions]} components={components} urlTransform={noteUrlTransform}>
            {renderedBody}
         </ReactMarkdown>
      </div>
   );
}
