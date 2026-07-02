// -- Library Imports --
import { useTranslation } from 'react-i18next';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { getGameVisual } from '@/lib/constants/gameVisuals';

// -- Type Imports --
import type { GameSystem } from '@/lib/types/common';

/*
 * The app's game reference tag: the game crest (gradient square + white icon, like DragIdentityPill) plus
 * the real game name tinted with the game's accent, on app-token pill chrome. One source of truth for
 * "this belongs to game X", so a game reads the same everywhere it appears. NEUTRAL items are
 * game-agnostic and render nothing.
 */
export function GameTag({ game, className }: { game: GameSystem; className?: string }) {
   const { t } = useTranslation();
   if (game === 'NEUTRAL') return null;

   const visual = getGameVisual(game);
   return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-border pr-2 text-xs font-medium', className)}>
         <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-white/25', visual.gradient)}>
            <visual.Icon className="size-4 text-white" />
         </span>
         <span className={cn('py-0.5', visual.accentText)}>{t(`Drawer.Types.${game}`)}</span>
      </span>
   );
}
