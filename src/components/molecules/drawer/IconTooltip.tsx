// -- React Imports --
import type { ReactNode } from 'react';

// -- Basic UI Imports --
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/*
 * A styled hover label for one of the drawer card's indicator icons (the type glyph, the game glyph).
 * The icons carry no text, so without this the user has to guess what they mean. The span trigger wraps
 * the icon tightly and keeps its place in the meta row - it just becomes the hover target.
 */
export function IconTooltip({ label, children }: { label: string; children: ReactNode }) {
   return (
      <Tooltip>
         <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">{children}</span>
         </TooltipTrigger>
         <TooltipContent>{label}</TooltipContent>
      </Tooltip>
   );
}
