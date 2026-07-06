// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Custom Hooks --
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';

// -- Local Imports --
import { parseImageHint } from '@/lib/notes/noteImageHint';

// -- Type Imports --
import type { NoteImageAlign } from '@/lib/notes/noteImageHint';

/*
 * The Note surface's OWN inline-image renderer. Inline images ride inside the markdown body as
 * `![alt](asset:<hash> "align width")`, a custom `asset:` scheme + a layout hint in the title. This
 * resolves the hash through `useAssetObjectUrl` and renders the image in-flow on the Paper palette,
 * forking on align: center/full render a block "figure" (block-styled spans, NOT <figure>/<figcaption>,
 * which are invalid inside react-markdown's image-wrapping <p>); left/right render an inline float that
 * prose wraps around (the token is glued to the start of its paragraph in the body, so the float opens it).
 *
 * SAFETY: it renders an <img> ONLY for the `asset:` scheme. Any other src - `http(s):`, a bare path,
 * anything - falls back to alt text only, so an imported (untrusted) note can never phone home on display.
 * This is Note-scoped; the shared card/board `img` renderer stays alt-text-only and is NOT loosened.
 *
 * LAYOUT: align + width% live in the title, parsed by `parseImageHint` (the single grammar home). Width%
 * resolves against the prose measure (the 68ch column), never the sheet; `full` ignores width (always 100%).
 */

/** Reads the `asset:<hash>` hash out of a src, or `null` when the src is any other (untrusted) scheme. */
function assetHashFromSrc(src: string | undefined): string | null {
   if (!src) return null;
   const match = /^asset:([0-9a-f]{6,})$/.exec(src.trim());
   return match ? match[1] : null;
}

/** The outer-wrapper classes per align (Juno's spec). Center/full are block; left/right float and clear their side. */
const ALIGN_WRAPPER: Record<NoteImageAlign, string> = {
   left: 'float-left mr-6 mb-3 mt-1 clear-left',
   right: 'float-right ml-6 mb-3 mt-1 clear-right',
   center: 'mx-auto my-6 block',
   full: 'my-8 block w-full',
};

/** Max-height cap per align: a taller float strands its wrapping text, so floats cap lower than center/full. */
const ALIGN_MAX_HEIGHT: Record<NoteImageAlign, string> = {
   left: 'max-h-[28rem]',
   right: 'max-h-[28rem]',
   center: 'max-h-[36rem]',
   full: 'max-h-[36rem]',
};

/** Caption placement per align: centered under center/full; left-aligned + tighter under a float. */
function captionClass(align: NoteImageAlign): string {
   return align === 'left' || align === 'right'
      ? 'mt-1.5 block text-left text-sm italic text-paper-foreground/60'
      : 'mt-2 block text-center text-sm italic text-paper-foreground/60';
}

/**
 * A block-styled "figure" span for one asset image, forked on align. `full` pins to 100% of the measure;
 * every other align applies `widthPct` as an inline `width` against the prose column. `break-inside-avoid`
 * keeps the image + caption from splitting a page (print-ready, harmless on screen).
 */
function AssetFigure({ hash, alt, align, widthPct }: { hash: string; alt: string; align: NoteImageAlign; widthPct: number }) {
   const { url } = useAssetObjectUrl(hash);
   // Width resolves against the prose measure; full ignores it. Left/right/center get an inline % width.
   const widthStyle = align === 'full' ? undefined : { width: `${widthPct}%` };

   return (
      <span className={cn('break-inside-avoid', ALIGN_WRAPPER[align])} style={widthStyle}>
         {url ? (
            <img src={url} alt={alt} className={cn('block h-auto w-full rounded-md object-contain', ALIGN_MAX_HEIGHT[align])} />
         ) : (
            // Loading, or a missing/reclaimed blob: a quiet placeholder frame, never a broken-image glyph.
            <span className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-paper-border text-sm text-paper-foreground/50">
               {alt || '…'}
            </span>
         )}
         {alt ? <span className={captionClass(align)}>{alt}</span> : null}
      </span>
   );
}

/**
 * The `img` component for the Note doc markdown map. Renders an `asset:` image in-flow with its layout
 * hint; any other src degrades to alt text (or nothing), preserving the untrusted-content safety.
 */
export function NoteImage({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
   const hash = assetHashFromSrc(src);
   const altText = alt ?? '';

   if (!hash) {
      // Non-asset (untrusted) src: alt text only, never an outbound <img> request.
      return altText ? <span className="opacity-70">{altText}</span> : null;
   }

   const { align, widthPct } = parseImageHint(title);
   return <AssetFigure hash={hash} alt={altText} align={align} widthPct={widthPct} />;
}
