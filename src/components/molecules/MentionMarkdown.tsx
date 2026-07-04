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
 * Renders authored text as GitHub-flavored Markdown with inline `{brace}` mention pills (status / tag). The
 * text color is inherited so it reads on any background; mention pills carry their own fixed game colors.
 * With `onMentionClick` the pills are buttons that forward the tapped segment (the caller materializes the
 * tracker); without it they are plain, non-interactive labels. Safe by default: no raw HTML, images render
 * their alt text only, links open in a new tab (mirrors the note renderer).
 */

interface MentionMarkdownProps {
   text: string;
   onMentionClick?: (segment: MentionSegment) => void;
   className?: string;
}

export function MentionMarkdown({ text, onMentionClick, className }: MentionMarkdownProps) {
   const components = useMemo(() => ({ ...proseMarkdownComponents, ...mentionComponents(onMentionClick) }), [onMentionClick]);
   return (
      <div className={cn('break-words', className)}>
         <ReactMarkdown remarkPlugins={[remarkGfm, remarkMentions]} components={components}>
            {text}
         </ReactMarkdown>
      </div>
   );
}
