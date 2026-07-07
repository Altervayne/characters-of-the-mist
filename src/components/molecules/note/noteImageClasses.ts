// -- Type Imports --
import type { NoteImageAlign } from '@/lib/notes/noteImageHint';

/*
 * The SINGLE source of the inline-image figure's Tailwind class-strings, shared by the two render paths so
 * they cannot drift: the react-markdown {@link import('./NoteImage').NoteImage} (Reading) and the CM6 live
 * editor's image widget (Live). Juno's rule - any style one path produces that the other doesn't makes a
 * mode switch jump - is enforced structurally by importing the same strings, not re-typing them.
 *
 * Images are BLOCKS, never floats. A floated image is out of normal flow, so its height is invisible to
 * CM6's line-height model and clicking below it lands on the wrong line - unfixable while it floats. So an
 * in-text image is a standalone block on its own line, aligned within the measure (left / center / right /
 * full) with NO text wrapping beside it, IDENTICALLY in Reading and Live. Vertical spacing is PADDING, not
 * margin, so a CM6 `block:true` widget's height-map (which counts padding, not margin) includes it. The
 * align stays in the markdown; only the render changed from a float to an aligned block.
 */

/** Outer-wrapper classes per align: an aligned in-flow block (never a float), spacing as padding. */
export const IMAGE_ALIGN_WRAPPER: Record<NoteImageAlign, string> = {
   left: 'mr-auto py-3 block',
   right: 'ml-auto py-3 block',
   center: 'mx-auto py-6 block',
   full: 'py-8 block w-full',
};

/** Max-height cap per align. */
export const IMAGE_ALIGN_MAX_HEIGHT: Record<NoteImageAlign, string> = {
   left: 'max-h-[28rem]',
   right: 'max-h-[28rem]',
   center: 'max-h-[36rem]',
   full: 'max-h-[36rem]',
};

/** The inner `<img>` classes (max-height appended per align). */
export const IMAGE_INNER = 'block h-auto w-full rounded-md object-contain';

/** The placeholder frame classes for a loading / missing blob. */
export const IMAGE_PLACEHOLDER =
   'flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-paper-border text-sm text-paper-foreground/50';

/** Caption placement per align: centered under center/full; left-aligned + tighter under a left/right block. */
export function imageCaptionClass(align: NoteImageAlign): string {
   return align === 'left' || align === 'right'
      ? 'mt-1.5 block text-left text-sm italic text-paper-foreground/60'
      : 'mt-2 block text-center text-sm italic text-paper-foreground/60';
}
