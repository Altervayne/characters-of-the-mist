// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { MentionSegment } from '@/lib/challenge/parseMentions';

/*
 * A single status/tag mention pill. LitM colors are fixed game content (green status, yellow italic tag),
 * readable on card paper and notes alike, not chrome-themed - factored here so City/Otherscape can diverge.
 * With `onMentionClick` the pill is a button that forwards its segment (the caller materializes it); without
 * it, a plain span. The pointerdown guard keeps a tap on a draggable surface (board) from starting a drag.
 */

const STATUS_PILL = 'rounded bg-green-700 px-1 py-0.5 font-medium text-green-50';
const TAG_PILL = 'rounded bg-yellow-500 px-1 py-0.5 font-medium italic text-yellow-950';
const INTERACTIVE = 'cursor-pointer hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type PillSegment = Extract<MentionSegment, { type: 'status' | 'tag' }>;

export function MentionPill({ segment, onMentionClick }: { segment: PillSegment; onMentionClick?: (segment: MentionSegment) => void }) {
   const className = segment.type === 'status' ? STATUS_PILL : TAG_PILL;
   const label = segment.type === 'status' ? `${segment.name}-${segment.tier}` : segment.name;
   if (onMentionClick) {
      return (
         <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onMentionClick(segment)}
            className={cn('pointer-events-auto', className, INTERACTIVE)}
         >
            {label}
         </button>
      );
   }
   return <span className={className}>{label}</span>;
}
