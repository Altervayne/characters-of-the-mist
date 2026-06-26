// -- React Imports --
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Folder, GripVertical, LayoutGrid } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { resolveCardComponent } from '@/components/organisms/cards/resolveCardComponent';
import { StatusTrackerCard } from '@/components/organisms/trackers/StatusTracker';
import { StoryTagTrackerCard } from '@/components/organisms/trackers/StoryTagTracker';
import { CharacterSheetPreview } from '@/components/molecules/CharacterSheetPreview';
import { StoryThemeTrackerCard } from '@/components/organisms/trackers/StoryThemeTracker';
import { FitToBox } from '@/components/molecules/drawer/FitToBox';
import { ItemDateLabel } from '@/components/molecules/drawer/ItemDateLabel';

// -- Utils Imports --
import { getItemTypeIcon } from '@/lib/utils/drawer-icons';
import { getGameVisual } from '@/lib/constants/gameVisuals';
import { boardContentBounds, itemCenter } from '@/lib/board/boardMiniMap';

// -- Type Imports --
import type { ReactElement } from 'react';
import type { DrawerItem, Folder as FolderType, GameSystem } from '@/lib/types/drawer';
import type { Board, ConnectionBoardContent, PinBoardContent, PostItBoardContent, ZoneBoardContent } from '@/lib/types/board';

/** The game glyph element (resolved in this module helper, not in render); neutral items have none. */
function gameGlyph(game: GameSystem): ReactElement | null {
   if (game === 'NEUTRAL') return null;
   const Icon = getGameVisual(game).Icon;
   return <Icon className="h-4 w-4 shrink-0" />;
}



/** The board's default note color, mirrored from the post-it item (a color-less note reads amber). */
const SCHEMATIC_POSTIT_COLOR = '#fde68a';

/**
 * Cheap board thumbnail: a schematic mini-map. Each item is a small block at its scaled board position
 * (the SVG viewBox IS the content bbox, so a wide board fills the width and a tall one centers as a
 * column), zones are faint regions behind their members, connections are hairlines between block
 * centers. Pure render - no item components, no asset loads - so the LAYOUT is the signal. The item
 * count survives as a subtle corner badge; an empty board keeps the glyph + count.
 */
function BoardPreview({ board }: { board: Board }) {
   const { t } = useTranslation();
   const itemCount = board.items.filter((item) => item.kind !== 'connection').length;
   const bounds = boardContentBounds(board.items);

   // Empty board: an empty SVG reads as broken, so keep the glyph + count.
   if (!bounds) {
      return (
         <div className="w-62.5 h-25 flex flex-col items-center justify-center gap-2 bg-popover/50 text-muted-foreground rounded-lg p-4 text-center">
            <LayoutGrid className="h-8 w-8" />
            <p className="text-xs">{t('Drawer.Types.boardItemCount', { count: itemCount })}</p>
         </div>
      );
   }

   const byId = new Map(board.items.map((item) => [item.id, item]));
   const zones = board.items.filter((item) => item.kind === 'zone');
   const connections = board.items.filter((item) => item.kind === 'connection');
   const blocks = board.items.filter((item) => item.kind !== 'zone' && item.kind !== 'connection');

   return (
      <div className="relative w-62.5 h-25 overflow-hidden rounded-lg bg-popover/50 p-1 text-foreground">
         <svg
            viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full"
         >
            {/* Zones behind: a faint region in the stored color, or a subtle theme tint when color-less. */}
            {zones.map((zone) => {
               const color = (zone.content as ZoneBoardContent).color;
               return (
                  <rect
                     key={zone.id}
                     x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx={2}
                     fill={color ?? 'currentColor'} fillOpacity={color ? 0.2 : 0.07}
                     stroke={color ?? 'currentColor'} strokeOpacity={0.35} strokeWidth={1}
                     vectorEffect="non-scaling-stroke"
                  />
               );
            })}

            {/* Connections: a hairline from center to center, skipping a deleted endpoint. */}
            {connections.map((conn) => {
               const content = conn.content as ConnectionBoardContent;
               const from = byId.get(content.from);
               const to = byId.get(content.to);
               if (!from || !to) return null;
               const a = itemCenter(from);
               const b = itemCenter(to);
               return (
                  <line
                     key={conn.id}
                     x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                     stroke={content.style.color} strokeOpacity={0.7} strokeWidth={1}
                     vectorEffect="non-scaling-stroke"
                  />
               );
            })}

            {/* Every other item: a block in its content color (post-it / pin) or a neutral theme block. */}
            {blocks.map((item) => {
               const ownColor = item.kind === 'post-it'
                  ? (item.content as PostItBoardContent).color ?? SCHEMATIC_POSTIT_COLOR
                  : item.kind === 'pin'
                     ? (item.content as PinBoardContent).color
                     : null;
               return (
                  <rect
                     key={item.id}
                     x={item.x} y={item.y} width={item.width} height={item.height} rx={2}
                     fill={ownColor ?? 'currentColor'} fillOpacity={ownColor ? 1 : 0.25}
                  />
               );
            })}
         </svg>

         {/* Subtle count badge over the map (app-themed), so the count survives the revamp. */}
         <span className="absolute bottom-1 right-1 rounded bg-popover/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {t('Drawer.Types.boardItemCount', { count: itemCount })}
         </span>
      </div>
   );
}

export function FolderPreview({ folder }: { folder: FolderType }) {
   return (
      <div
            className="flex items-center justify-between gap-2 py-1 pl-1 pr-2 rounded bg-popover/50 border-2 border-border"
         >
         <div
            className="flex h-8 items-center gap-2 truncate "
         >
            <GripVertical
               className="h-5 w-5 shrink-0 text-accent-foreground cursor-grab"
            />
            <Folder className="h-6 w-6 shrink-0 text-accent-foreground"/>
            <span className="truncate font-medium text-sm">{folder.name}</span>
         </div>
      </div>
   );
}

/**
 * Static preview card for a drawer item: name, a non-interactive snapshot of the
 * stored content, and the game/type label.
 *
 * @param item - The drawer item to preview.
 * @param headerAction - Optional control rendered on the title row (e.g. the
 *   mobile context-menu button), so it reads as a corner action of this card
 *   rather than floating in a separate column beside it. Desktop and drag-overlay
 *   callers omit it and the title row keeps its original single-element layout.
 * @param headerActionLeft - Places `headerAction` on the left of the title
 *   instead of the right, to follow left-handed placement on mobile.
 */
export function DrawerItemPreview({
   item,
   headerAction,
   headerActionLeft = false,
}: {
   // Browse passes a dated `DrawerItemRecord`; the drag overlay / mobile may pass a nested item without
   // dates (the date label then renders nothing), so the date fields are optional here.
   item: DrawerItem & { createdAt?: number; updatedAt?: number };
   headerAction?: ReactNode;
   headerActionLeft?: boolean;
}) {
   const { t } = useTranslation();

   const renderSnapshot = () => {
      const { content, type, game } = item;

      // Game items (Legends/City/Otherscape) and NEUTRAL items (e.g. a portrait image
      // card) have previews; the card mapping is delegated to resolveCardComponent,
      // while trackers and full sheets are game-independent. Anything else falls
      // through to the unavailable-preview placeholder below.
      if (game === 'LEGENDS' || game === 'CITY_OF_MIST' || game === 'OTHERSCAPE' || game === 'NEUTRAL') {
         if ('cardType' in content) {
            const Component = resolveCardComponent(type, game);
            if (Component) {
               return <Component card={content} isDrawerPreview />;
            }
         }

         if ('trackerType' in content) {
            if (content.trackerType === 'STATUS') {
               return <StatusTrackerCard tracker={content} isDrawerPreview />;
            }
            if (content.trackerType === 'STORY_TAG') {
               return <StoryTagTrackerCard tracker={content} isDrawerPreview />;
            }
            if (content.trackerType === 'STORY_THEME') {
               return <StoryThemeTrackerCard tracker={content} isDrawerPreview />;
            }
         }

         if (type === 'FULL_CHARACTER_SHEET') {
            return <CharacterSheetPreview item={item} />;
         }

         if (type === 'FULL_BOARD') {
            return <BoardPreview board={content as Board} />;
         }
      }

      return (
         <div className="w-62.5 h-25 flex items-center justify-center bg-popover/50 text-muted-foreground rounded-lg p-4 text-center">
               <p className="text-xs">{t('Drawer.Types.unavailablePreview')}</p>
         </div>
      );
   };

   return (
      // Uniform card: a FIXED preview area (every type's preview is fit into it), then the name, then a
      // meta row (type glyph + game glyph + date). Same footprint regardless of type.
      <div className="flex flex-col gap-2 rounded-md border-2 border-border bg-card/75 p-2 transition-colors hover:bg-muted">
         <FitToBox className="pointer-events-none h-32 w-full rounded-md bg-popover/30">
            {renderSnapshot()}
         </FitToBox>

         <div className={cn('flex items-center gap-2', headerActionLeft && 'flex-row-reverse')}>
            <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">{item.name}</p>
            {headerAction}
         </div>

         {/* Meta: app-themed chrome (the game glyph is content's color via the icon, but the row is muted). */}
         <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            {getItemTypeIcon(item.type)}
            {gameGlyph(item.game)}
            <ItemDateLabel type={item.type} createdAt={item.createdAt} updatedAt={item.updatedAt} className="truncate" />
         </div>
      </div>
   );
};