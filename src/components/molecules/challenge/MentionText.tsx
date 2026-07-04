// -- Utils Imports --
import { cn } from '@/lib/utils';
import { parseMentions } from '@/lib/challenge/parseMentions';

// -- Type Imports --
import type { MentionSegment } from '@/lib/challenge/parseMentions';

/*
 * Renders a Challenge Card's authored text with `[bracket]` mentions styled as pills: a green pill for a
 * status (`name-tier`), a yellow italic pill for a tag. LitM colors are fixed game content (not
 * chrome-themed) and readable on the card paper; factored here so City/Otherscape can diverge later.
 *
 * Presentational: with `onMentionClick`, the mention pills become buttons that forward the tapped segment
 * (the caller applies the status/tag). Without it (editor preview, board embed), they stay plain text.
 */

const STATUS_PILL = 'rounded bg-green-700 px-1 py-0.5 font-medium text-green-50';
const TAG_PILL = 'rounded bg-yellow-500 px-1 py-0.5 font-medium italic text-yellow-950';
const INTERACTIVE = 'cursor-pointer hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface MentionTextProps {
   text: string;
   /** When set, status/tag pills become buttons that forward the tapped segment. */
   onMentionClick?: (segment: MentionSegment) => void;
}

export function MentionText({ text, onMentionClick }: MentionTextProps) {
   const segments = parseMentions(text);
   return (
      <>
         {segments.map((segment, index) => {
            if (segment.type === 'text') {
               return <span key={index}>{segment.text}</span>;
            }
            const className = segment.type === 'status' ? STATUS_PILL : TAG_PILL;
            const label = segment.type === 'status' ? `${segment.name}-${segment.tier}` : segment.name;
            if (onMentionClick) {
               return (
                  <button key={index} type="button" onClick={() => onMentionClick(segment)} className={cn(className, INTERACTIVE)}>
                     {label}
                  </button>
               );
            }
            return <span key={index} className={className}>{label}</span>;
         })}
      </>
   );
}
