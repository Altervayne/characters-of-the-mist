// -- React Imports --
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { getItemTypeIcon } from '@/lib/utils/drawer-icons';
import { getGameVisual } from '@/lib/constants/gameVisuals';

// -- Component Imports --
import { ItemDateLabel } from '@/components/molecules/drawer/ItemDateLabel';

// -- Type Imports --
import type { GeneralItemType, GameSystem } from '@/lib/types/drawer';

/*
 * The shared List-view row layout, used by both the browse list and the search results so they read
 * identically: [leading slot] [type glyph] [name - owns the flexible space] [game glyph] [date - a
 * right-aligned column] [trailing slot]. The name flexes and only truncates when genuinely too long;
 * the date sits in its own right-aligned column so dates scan straight down the list. Leading hosts the
 * browse drag-grip (none for results); trailing hosts the actions menu. The row exposes `group/row` so
 * those slots can hover-reveal (`group-hover/row:opacity-100`) without reflow.
 */

/**
 * The game glyph element (resolved in this module helper, not in render); neutral items have none. The
 * dense rows use a native `title` (a lightweight hover label, no per-row tooltip machinery) to name it.
 */
function gameGlyph(game: GameSystem, title: string): ReactElement | null {
   if (game === 'NEUTRAL') return null;
   const Icon = getGameVisual(game).Icon;
   return <span title={title} className="inline-flex shrink-0"><Icon className="h-4 w-4 shrink-0 text-muted-foreground" /></span>;
}

interface DrawerListRowProps {
   type: GeneralItemType;
   name: string;
   game: GameSystem;
   createdAt?: number;
   updatedAt?: number;
   /** Leading slot, left of the type glyph (the browse drag-grip; absent for results). */
   leading?: ReactNode;
   /** Trailing slot, right of the date column (the actions menu). */
   trailing?: ReactNode;
   className?: string;
}

export function DrawerListRow({ type, name, game, createdAt, updatedAt, leading, trailing, className }: DrawerListRowProps) {
   const { t } = useTranslation();
   return (
      <div className={cn('group/row flex min-h-8 items-center gap-2 rounded py-1 pl-1 pr-2 hover:bg-muted data-[state=open]:bg-muted', className)}>
         {leading}
         {/* Native title hover labels name the otherwise-unlabelled indicator icons (type + game). */}
         <span title={t(`Drawer.filters.itemType.${type}`)} className="inline-flex shrink-0">{getItemTypeIcon(type)}</span>
         <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
         {gameGlyph(game, t(`Drawer.Types.${game}`))}
         <ItemDateLabel
            type={type}
            createdAt={createdAt}
            updatedAt={updatedAt}
            className="min-w-16 shrink-0 whitespace-nowrap text-right text-xs text-muted-foreground"
         />
         {trailing}
      </div>
   );
}
