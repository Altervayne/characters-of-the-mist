// -- Utils Imports --
import { cn } from '@/lib/utils';
import { getGameVisual } from '@/lib/constants/gameVisuals';

// -- Type Imports --
import type { LucideIcon } from 'lucide-react';
import type { GameSystem } from '@/lib/types/common';

/**
 * The "what am I dragging" pill shown on the RIGHT of the drag-morph cursor cluster
 * (tabs polish-9/10). A flat app-token pill carrying a leading "what is this" mark
 * plus the item's name. It lives on the CONSUMER side — the drag-morph engine stays
 * behavior-agnostic and receives this only as an opaque `ReactNode` — so the
 * `gameVisuals` / type-icon lookup happens here, never in the engine.
 *
 * Two mutually-exclusive leading marks: a **game crest** (gradient square + white
 * icon) when a `game` is supplied — reserved for characters; otherwise a **neutral
 * type icon** when `icon` is supplied (folders, components, sheet items). With
 * neither, the pill is label-only.
 *
 * @param props.game - The game whose crest to show; reserved for characters.
 * @param props.icon - A neutral leading type icon for non-characters.
 * @param props.label - The item's display name.
 */
export function DragIdentityPill({
   game = null,
   icon: Icon,
   label,
}: {
   game?: GameSystem | null;
   icon?: LucideIcon;
   label: string;
}) {
   const visual = game ? getGameVisual(game) : null;
   const Crest = visual?.Icon;

   return (
      <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border-[0.5px] border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md">
         {visual && Crest ? (
            <span
               className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-[5px] ring-1 ring-inset ring-white/25',
                  visual.gradient,
               )}
            >
               <Crest className="size-2.5 text-white" />
            </span>
         ) : Icon ? (
            <span className="flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-muted text-muted-foreground">
               <Icon className="size-2.5" />
            </span>
         ) : null}
         <span className="max-w-[10rem] truncate">{label}</span>
      </div>
   );
}
