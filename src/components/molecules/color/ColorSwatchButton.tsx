/*
 * A single 22px color swatch, shared by the curated palette and the recents row.
 * Ported from Documinter; only the design tokens differ.
 */

interface ColorSwatchButtonProps {
   /** Hex color the swatch represents and applies when clicked. */
   color: string;
   /** Whether this swatch matches the currently active color (draws a ring). */
   isActive: boolean;
   /** Called with the swatch color when clicked. */
   onPick: (color: string) => void;
}

export function ColorSwatchButton({ color, isActive, onPick }: ColorSwatchButtonProps) {
   return (
      <button
         type="button"
         title={color}
         onPointerDown={(event) => event.stopPropagation()}
         onClick={() => onPick(color)}
         className="cursor-pointer rounded-md transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
         style={{
            width: 22,
            height: 22,
            backgroundColor: color,
            // The active ring leaves a gap in the popover's own background color.
            boxShadow: isActive ? `0 0 0 2px var(--color-popover), 0 0 0 4px ${color}` : '0 0 0 1px rgba(0,0,0,0.18)',
         }}
      />
   );
}
