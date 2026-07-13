// -- React Imports --
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Check, Columns3, Grid3x3, Grip, Hexagon, Rows3, Square, type LucideIcon } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { gridBackground } from '@/lib/board/gridStyle';
import { hexTile } from '@/lib/board/hexGrid';

// -- Component Imports --
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

// -- Type Imports --
import type { BoardGrid, BoardGridType } from '@/lib/types/board';

/*
 * The grid selector: a tokened dropdown launched from the toolbar grid button. Each row is a live
 * preview swatch + label, with a check + primary ring on the active style. The swatches reuse the same
 * background builder the canvas grid does (and the same honeycomb geometry), so the menu can't drift
 * from what the board actually paints.
 */

/** The grid styles in menu order, each with its trigger/row icon and i18n label key. */
const GRID_ROWS: { type: BoardGridType; icon: LucideIcon; labelKey: string }[] = [
   { type: 'none', icon: Square, labelKey: 'gridNone' },
   { type: 'dots', icon: Grip, labelKey: 'gridDots' },
   { type: 'lines', icon: Grid3x3, labelKey: 'gridCrosshatch' },
   { type: 'h-lines', icon: Rows3, labelKey: 'gridHorizontalLines' },
   { type: 'v-lines', icon: Columns3, labelKey: 'gridVerticalLines' },
   { type: 'hex', icon: Hexagon, labelKey: 'gridHex' },
];

/** Fixed spacing for the preview swatches: small enough to read the pattern in a ~28px tile. */
const SWATCH_SPACING = 8;
const SWATCH_HEX_SIZE = 6;
const SWATCH_VIEWPORT = { x: 0, y: 0, zoom: 1 };

/** A ~28px preview of one grid style, mirroring the canvas render (CSS background, or the SVG hive). */
function GridSwatch({ type }: { type: BoardGridType }) {
   const patternId = useId();
   const base = 'size-7 shrink-0 overflow-hidden rounded border border-border bg-background text-foreground/60';
   if (type === 'hex') {
      const tile = hexTile(SWATCH_HEX_SIZE);
      return (
         <span className={base} aria-hidden>
            <svg className="size-full">
               <defs>
                  <pattern id={patternId} patternUnits="userSpaceOnUse" width={tile.width} height={tile.height}>
                     <path d={tile.path} fill="none" stroke="currentColor" strokeWidth={1} />
                  </pattern>
               </defs>
               <rect width="100%" height="100%" fill={`url(#${patternId})`} />
            </svg>
         </span>
      );
   }
   return <span className={base} style={gridBackground({ type }, SWATCH_SPACING, SWATCH_VIEWPORT)} aria-hidden />;
}

export function BoardGridMenu({ grid, onSelect }: { grid: BoardGrid; onSelect: (type: BoardGridType) => void }) {
   const { t } = useTranslation();
   const active = GRID_ROWS.find((row) => row.type === grid.type) ?? GRID_ROWS[0];
   const ActiveIcon = active.icon;

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <button
               type="button"
               title={t(`BoardView.${active.labelKey}`)}
               aria-label={t(`BoardView.${active.labelKey}`)}
               className="flex shrink-0 items-center justify-center rounded p-1.5 text-foreground hover:bg-muted cursor-pointer"
            >
               <ActiveIcon className="h-4 w-4" />
            </button>
         </DropdownMenuTrigger>
         <DropdownMenuContent side="bottom" align="start">
            {GRID_ROWS.map(({ type, labelKey }) => (
               <DropdownMenuItem
                  key={type}
                  onSelect={() => onSelect(type)}
                  className={cn('gap-2', type === grid.type && 'ring-1 ring-primary')}
               >
                  <GridSwatch type={type} />
                  <span className="flex-1">{t(`BoardView.${labelKey}`)}</span>
                  {type === grid.type && <Check className="size-4 text-primary" />}
               </DropdownMenuItem>
            ))}
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
