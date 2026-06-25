import { Building2, CircuitBoard, ScrollText, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GameSystem } from '@/lib/types/drawer';

/**
 * Returns the lucide icon *component* for a game system, so callers size and style it
 * themselves. The single source for game glyphs (the same ones the board's create radial
 * uses): a scroll for Legends, a building for City of Mist, a circuit board for Otherscape,
 * and a neutral sparkle for the game-agnostic / unknown case.
 */
export function getGameSystemIconComponent(game: GameSystem): LucideIcon {
   switch (game) {
      case 'LEGENDS':
         return ScrollText;
      case 'CITY_OF_MIST':
         return Building2;
      case 'OTHERSCAPE':
         return CircuitBoard;
      default:
         return Sparkles;
   }
}

/**
 * Returns the game glyph as a ready element (resolving the component inside this module, not in a
 * caller's render). Mirrors {@link import('./drawer-icons').getItemTypeIcon}. The icon inherits its
 * color from the surrounding text, so callers theme it via the parent.
 */
export function getGameSystemIcon(game: GameSystem, className = 'h-5 w-5 shrink-0'): React.ReactElement {
   const Icon = getGameSystemIconComponent(game);
   return <Icon className={className} />;
}
