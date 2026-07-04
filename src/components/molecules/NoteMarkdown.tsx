// -- Library Imports --
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { remarkMentions } from '@/lib/challenge/remarkMentions';

// -- Component Imports --
import { proseMarkdownComponents, mentionComponents } from './markdown/markdownComponents';

// -- Type Imports --
import type { MentionSegment } from '@/lib/challenge/parseMentions';

/*
 * A Markdown renderer for board NOTES (post-its, journal pages). It INHERITS its text color (a post-it's
 * color is derived from its background, so a fixed token would make a dark note unreadable) - the shared
 * prose components tint every accent with translucent `currentColor`, never a theme token. Spacing is tight
 * for a small note, not an article. `{brace}` mentions render as pills; with `onMentionClick` a tap mints a
 * board tracker beside the note (the caller supplies the board handler), else they are plain labels.
 *
 * Safe by default for imported (untrusted) boards: no `rehype-raw` (embedded HTML / scripts never render),
 * react-markdown's default URL sanitizing is kept, images render their alt text only (so a note can't phone
 * home on display), and links open in a new tab. The whole block is pointer-transparent so a click falls
 * through to select the note - only links and mention pills keep pointer events, so they act instead of
 * selecting.
 */

export function NoteMarkdown({ content, className, onMentionClick }: { content: string; className?: string; onMentionClick?: (segment: MentionSegment) => void }) {
   const components = useMemo(() => ({ ...proseMarkdownComponents, ...mentionComponents(onMentionClick) }), [onMentionClick]);
   return (
      <div className={cn('pointer-events-none text-sm leading-snug break-words', className)}>
         <ReactMarkdown remarkPlugins={[remarkGfm, remarkMentions]} components={components}>
            {content}
         </ReactMarkdown>
      </div>
   );
}
