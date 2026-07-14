// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { TokenSet } from '@/lib/theme/themeTokens';

/** A mini three-stripe preview of a theme's background / primary / accent, so a theme reads at a glance. */
export function ThemeSwatch({ tokens, className }: { tokens: TokenSet; className?: string }) {
   return (
      <span className={cn('flex h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border', className)}>
         <span className="flex-1" style={{ backgroundColor: tokens.background }} />
         <span className="flex-1" style={{ backgroundColor: tokens.primary }} />
         <span className="flex-1" style={{ backgroundColor: tokens.accent }} />
      </span>
   );
}
