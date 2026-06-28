// -- Utils Imports --
import { contrastRatio } from '@/lib/color';

// -- Type Imports --
import type { ChromeTokenKey, TokenSet } from '@/lib/theme/themeTokens';

/*
 * The non-blocking contrast check behind the editor's warnings: for one mode's token set, which
 * foreground-on-its-surface pairs read below the AA text floor. Derived themes (themes-2) clear this by
 * construction, so a flag almost always means a manual color went too close to its background - we inform,
 * never block. The ratio itself comes from the shared `contrastRatio`; this file only picks the pairs.
 */

/** The WCAG AA contrast floor for normal text. */
export const AA_CONTRAST_FLOOR = 4.5;

/** The foreground/surface pairs a readable theme keeps above the floor: [foreground token, surface token]. */
export const CONTRAST_PAIRS: [ChromeTokenKey, ChromeTokenKey][] = [
   ['foreground', 'background'],
   ['card-foreground', 'card'],
   ['popover-foreground', 'popover'],
   ['primary-foreground', 'primary'],
   ['secondary-foreground', 'secondary'],
   ['accent-foreground', 'accent'],
   ['muted-foreground', 'muted'],
   ['destructive-foreground', 'destructive'],
];

/** One failing pair: the foreground token to flag, the surface it sits on, and their measured ratio. */
export interface ContrastWarning {
   foreground: ChromeTokenKey;
   surface: ChromeTokenKey;
   ratio: number;
}

/** The pairs in a token set that fall below the floor, in {@link CONTRAST_PAIRS} order. */
export function lowContrastPairs(set: TokenSet, floor = AA_CONTRAST_FLOOR): ContrastWarning[] {
   const warnings: ContrastWarning[] = [];
   for (const [foreground, surface] of CONTRAST_PAIRS) {
      const ratio = contrastRatio(set[foreground], set[surface]);
      if (ratio < floor) warnings.push({ foreground, surface, ratio });
   }
   return warnings;
}
