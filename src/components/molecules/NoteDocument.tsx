// -- Library Imports --
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { remarkMentions } from '@/lib/challenge/remarkMentions';

// -- Component Imports --
import { docMarkdownComponents } from './markdown/docMarkdownComponents';
import { mentionComponents } from './markdown/markdownComponents';

// -- Type Imports --
import type { MentionSegment } from '@/lib/challenge/parseMentions';

/*
 * The document Markdown renderer for a Note tab's PREVIEW (resting) state. It reuses the
 * remark + mention pipeline wholesale but at DOCUMENT scale via `docMarkdownComponents` (a
 * fork of the card prose map), and adds the reading measure cap - `max-w-[68ch]`, centered -
 * so lines don't run the full width of a wide monitor. `{brace}` mentions render as their
 * fixed-color pills; without `onMentionClick` they are plain, non-interactive labels.
 *
 * Safe by default (mirrors the note/mention renderers): no raw HTML, images render their alt
 * text only (the inline-image renderer is a later phase), links open in a new tab.
 */

interface NoteDocumentProps {
   body: string;
   onMentionClick?: (segment: MentionSegment) => void;
   className?: string;
}

export function NoteDocument({ body, onMentionClick, className }: NoteDocumentProps) {
   const components = useMemo(() => ({ ...docMarkdownComponents, ...mentionComponents(onMentionClick) }), [onMentionClick]);
   return (
      <div className={cn('mx-auto w-full max-w-[68ch] text-base break-words', className)}>
         <ReactMarkdown remarkPlugins={[remarkGfm, remarkMentions]} components={components}>
            {body}
         </ReactMarkdown>
      </div>
   );
}
