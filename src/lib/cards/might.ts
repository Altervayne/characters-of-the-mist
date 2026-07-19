// -- Icon Imports --
import { Crown, Leaf, Swords, type LucideIcon } from 'lucide-react';

// -- Type Imports --
import type { MightLevel } from '@/lib/types/character';

/*
 * The three Might levels' shared identity: icon + signature color. LitM theme cards and challenge Mighty
 * tags both key off this, so a level always reads the same across the app. The colors are each level's
 * theme-card header color (green / rust-orange / deep-blue) - a level's own identity color, like a status
 * being green, so it holds even against a card's theme tokens.
 */

/** The Might levels in tier order. */
export const MIGHT_LEVELS: MightLevel[] = ['Origin', 'Adventure', 'Greatness'];

/** Each level's Lucide icon (Origin leaf / Adventure crossed swords / Greatness crown). */
export const MIGHT_ICONS: Record<MightLevel, LucideIcon> = {
   Origin: Leaf,
   Adventure: Swords,
   Greatness: Crown,
};

/** Each level's signature color, taken from its theme-card header. */
export const MIGHT_LEVEL_COLORS: Record<MightLevel, string> = {
   Origin: 'hsl(131 8% 51%)',
   Adventure: 'hsl(15 30% 49%)',
   Greatness: 'hsl(235 10% 51%)',
};

/** The icon for a Might level. */
export function mightIcon(level: MightLevel): LucideIcon {
   return MIGHT_ICONS[level];
}

/** The identity color for a Might level. */
export function mightLevelColor(level: MightLevel): string {
   return MIGHT_LEVEL_COLORS[level];
}
