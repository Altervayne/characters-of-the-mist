// -- Library Imports --
import { useMemo } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { remarkMentions } from '@/lib/challenge/remarkMentions';

// -- Component Imports --
import { docMarkdownComponents } from './markdown/docMarkdownComponents';
import { mentionComponents } from './markdown/markdownComponents';
import { NoteImage } from './note/NoteImage';

// -- Type Imports --
import type { Components } from 'react-markdown';
import type { MentionSegment } from '@/lib/challenge/parseMentions';

/*
 * The document Markdown renderer for a Note tab's PREVIEW (resting) state. It reuses the
 * remark + mention pipeline wholesale but at DOCUMENT scale via `docMarkdownComponents` (a
 * fork of the card prose map), and adds the reading measure cap - `max-w-[68ch]`, centered -
 * so lines don't run the full width of a wide monitor. `{brace}` mentions render as their
 * fixed-color pills; without `onMentionClick` they are plain, non-interactive labels.
 *
 * Inline images are the Note surface's OWN renderer ({@link NoteImage}): it resolves the `asset:`
 * scheme to a stored image and refuses any other (untrusted) src, keeping the shared doc map's
 * alt-text-only `img` intact for any non-note consumer. No raw HTML; links open in a new tab.
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
   body: string;
   onMentionClick?: (segment: MentionSegment) => void;
   className?: string;
}

export function NoteDocument({ body, onMentionClick, className }: NoteDocumentProps) {
   const components = useMemo(() => ({ ...docMarkdownComponents, ...noteImageComponent, ...mentionComponents(onMentionClick) }), [onMentionClick]);
   return (
      <div className={cn('mx-auto w-full max-w-[68ch] text-base break-words', className)}>
         <ReactMarkdown remarkPlugins={[remarkGfm, remarkMentions]} components={components} urlTransform={noteUrlTransform}>
            {body}
         </ReactMarkdown>
      </div>
   );
}
