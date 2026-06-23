// -- React Imports --
import type { ReactNode } from 'react';

// -- Basic UI Imports --
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// -- Component Imports --
import { ColorPopover } from './ColorPopover';

/*
 * The shared color-picker popover: a Radix Popover that portals the {@link ColorPopover}
 * contents to the body so they float above everything (essential on the board, where each
 * item box is its own stacking context inside the transformed world layer). Radix anchors
 * to the trigger's live rect, so it lands correctly at any pan/zoom, and owns dismissal
 * (outside-click / Escape) via `onOpenChange`.
 *
 * The discrete swatch / remove actions close (their `onClose` flips the controlled open
 * state); the full picker applies live through `onApply` without closing.
 */

interface ColorPickerPopoverProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   /** The clickable color swatch (rendered as the Radix trigger). */
   trigger: ReactNode;
   activeColor: string | undefined;
   palette: readonly string[];
   recent: readonly string[];
   recentLabel: string;
   removeLabel: string;
   onApply: (color: string | undefined) => void;
}

export function ColorPickerPopover({ open, onOpenChange, trigger, activeColor, palette, recent, recentLabel, removeLabel, onApply }: ColorPickerPopoverProps) {
   return (
      <Popover open={open} onOpenChange={onOpenChange}>
         <PopoverTrigger asChild>{trigger}</PopoverTrigger>
         <PopoverContent align="center" sideOffset={6} className="w-62 overflow-hidden p-0">
            <ColorPopover
               activeColor={activeColor}
               palette={palette}
               recent={recent}
               recentLabel={recentLabel}
               removeLabel={removeLabel}
               onApply={onApply}
               onClose={() => onOpenChange(false)}
            />
         </PopoverContent>
      </Popover>
   );
}
