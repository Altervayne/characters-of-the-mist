// -- Utils Imports --
import { cn } from '@/lib/utils';
import { getGameVisual } from '@/lib/constants/gameVisuals';

// -- Type Imports --
import type { GameSystem } from '@/lib/types/common';

/**
 * The "what am I dragging" pill shown on the RIGHT of the drag-morph cursor cluster
 * (tabs polish-9). A flat app-token pill carrying an optional game crest plus the
 * item's name. It lives on the CONSUMER side — the drag-morph engine stays
 * behavior-agnostic and receives this only as an opaque `ReactNode` — so the
 * `gameVisuals` lookup happens here, never in the engine.
 *
 * The crest is shown only when a `game` is supplied (a drawer character); name-only
 * drags (components, folders, tabs, sheet items) pass no `game` and render just the
 * label.
 *
 * @param props.game - The game whose crest to show, or null/undefined for label-only.
 * @param props.label - The item's display name.
 */
export function DragIdentityPill({ game = null, label }: { game?: GameSystem | null; label: string }) {
   const visual = getGameVisual(game);
   const Crest = visual.Icon;

   return (
      <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border-[0.5px] border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md">
         {game && (
            <span
               className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-[5px] ring-1 ring-inset ring-white/25',
                  visual.gradient,
               )}
            >
               <Crest className="size-2.5 text-white" />
            </span>
         )}
         <span className="max-w-[10rem] truncate">{label}</span>
      </div>
   );
}
