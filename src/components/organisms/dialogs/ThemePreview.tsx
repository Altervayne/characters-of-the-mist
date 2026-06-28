// -- React Imports --
import type { CSSProperties } from 'react';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { CHROME_TOKEN_KEYS } from '@/lib/theme/themeTokens';

// -- Type Imports --
import type { TokenSet } from '@/lib/theme/themeTokens';

/*
 * One live theme-preview pane built from REAL chrome (not swatches), so it shows exactly what the app would
 * render. The token set + radius are applied as INLINE CSS variables on the pane, scoping the theme to this
 * box only; the dark pane ALSO carries the `.dark` class so any `dark:` variant resolves like real dark mode.
 */

/** The 19 tokens + radius as inline CSS custom properties for the pane container. */
function paneVars(tokenSet: TokenSet, radius: string): CSSProperties {
   const vars: Record<string, string> = { '--radius': radius };
   for (const key of CHROME_TOKEN_KEYS) vars[`--${key}`] = tokenSet[key];
   return vars as CSSProperties;
}

export function ThemePreview({ tokenSet, radius, dark, label, warning }: { tokenSet: TokenSet; radius: string; dark: boolean; label: string; warning?: string }) {
   return (
      <div
         style={paneVars(tokenSet, radius)}
         // `light` opts this pane out of the app's `dark:` variant so it renders its light state even when
         // the app is dark; the dark pane carries `dark` so its `dark:` refinements fire as intended.
         className={cn('flex flex-1 flex-col gap-2 overflow-hidden rounded-md border border-border bg-background p-3 text-foreground', dark ? 'dark' : 'light')}
      >
         <div className="flex items-center justify-between gap-2">
            <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
            {warning && <span className="text-[0.6rem] font-semibold text-destructive">{warning}</span>}
         </div>

         {/* A card with header + muted body text. */}
         <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card text-card-foreground">
            <div className="border-b border-border px-3 py-2">
               <div className="text-sm font-semibold">Card title</div>
               <div className="text-xs text-muted-foreground">Muted description text.</div>
            </div>
            <div className="flex flex-col gap-2 p-3">
               <div className="flex flex-wrap gap-1.5">
                  <Button size="sm">Primary</Button>
                  <Button size="sm" variant="secondary">Secondary</Button>
                  <Button size="sm" variant="destructive">Delete</Button>
                  <Button size="sm" variant="outline">Outline</Button>
               </div>
               <Input className="h-8" placeholder="Input field" readOnly />
               {/* A bordered element + the ring color as a swatch (the focus-ring token). */}
               <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border px-2 py-1.5 text-xs">
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: 'var(--ring)' }} />
                  <span>Bordered row · focus ring</span>
               </div>
            </div>
         </div>
      </div>
   );
}
