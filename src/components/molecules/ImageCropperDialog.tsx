// -- React Imports --
import { Suspense, lazy, useMemo, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Loader2, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

// -- Basic UI Imports --
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { PointerSlider } from '@/components/molecules/PointerSlider';

// -- Pipeline --
import { cropImage, type CropRegion } from '@/lib/assets/cropImage';

// -- Type Imports --
import type { Area, CropperProps, Point } from 'react-easy-crop';

/*
 * The crop stage: the image pans/zooms/rotates beneath a fixed frame in the destination's
 * shape, and the framed region is what gets cut. react-easy-crop draws the stage and reports
 * the region; our canvas does the actual cut. The heavy widget is loaded lazily so it lands in
 * its own chunk, never the eager bundle. Cutting produces raw pixels only - the clamp + webp
 * encode is the caller's downstream step.
 */

// The stage uses only these props; the rest ride react-easy-crop's own defaults. Typing the lazy
// component to this subset keeps the widget's default-backed props from reading as required.
type StageProps = Pick<
   CropperProps,
   | 'image'
   | 'crop'
   | 'zoom'
   | 'rotation'
   | 'aspect'
   | 'minZoom'
   | 'maxZoom'
   | 'objectFit'
   | 'onCropChange'
   | 'onZoomChange'
   | 'onRotationChange'
   | 'onCropComplete'
   | 'style'
>;

const Cropper = lazy(async () => {
   const module = await import('react-easy-crop');
   return { default: module.default as unknown as ComponentType<StageProps> };
});

/** Zoom bounds; min keeps the image covering the frame, so a locked frame never letterboxes. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
/** Below this on the short edge the cut is too small to be worth keeping; Accept is blocked. */
const MIN_CROP_EDGE_PX = 200;

/** Over-photo legibility colors: fixed, not tokens, so the frame reads on any image. */
const FRAME_STYLE = {
   border: '2px solid rgba(255,255,255,0.9)',
   boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 0 0 9999em rgba(0,0,0,0.5)',
} as const;

interface ImageCropperDialogProps {
   /** Object URL of the source, for the stage preview. */
   imageUrl: string;
   /** The decoded, EXIF-oriented source the cut is taken from. */
   bitmap: ImageBitmap;
   /** Locked destination ratio (width / height), or `'free'` to frame the whole image. */
   aspect: number | 'free';
   onCancel: () => void;
   onComplete: (blob: Blob) => void;
}

export function ImageCropperDialog({ imageUrl, bitmap, aspect, onCancel, onComplete }: ImageCropperDialogProps) {
   const { t } = useTranslation();
   const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
   const [zoom, setZoom] = useState(1);
   const [rotation, setRotation] = useState(0);
   const [region, setRegion] = useState<CropRegion | null>(null);
   const [isCutting, setIsCutting] = useState(false);

   // 'free' frames the whole image (no forced crop shape); a locked zone uses its own ratio.
   const frameAspect = aspect === 'free' ? bitmap.width / bitmap.height : aspect;

   const tooSmall = region !== null && Math.min(region.width, region.height) < MIN_CROP_EDGE_PX;

   const reset = () => {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
   };

   const accept = async () => {
      if (!region) return;
      setIsCutting(true);
      try {
         onComplete(await cropImage(bitmap, region, rotation));
      } catch {
         setIsCutting(false);
      }
   };

   return (
      <Dialog open onOpenChange={(open) => !open && onCancel()}>
         <DialogContent showCloseButton={false} className="max-w-3xl gap-0 overflow-hidden p-0">
            {/* Header: title + a live preview of the crop in its destination shape. */}
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
               <DialogTitle className="text-base">{t('ImageCropper.title')}</DialogTitle>
               <DestinationPreview imageUrl={imageUrl} region={region} rotation={rotation} source={bitmap} aspect={frameAspect} />
            </div>

            {/* Stage: the image under a fixed frame. */}
            <div className="relative h-[min(60vh,480px)] w-full bg-muted">
               <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                  <Cropper
                     image={imageUrl}
                     crop={crop}
                     zoom={zoom}
                     rotation={rotation}
                     aspect={frameAspect}
                     minZoom={MIN_ZOOM}
                     maxZoom={MAX_ZOOM}
                     objectFit="cover"
                     onCropChange={setCrop}
                     onZoomChange={setZoom}
                     onRotationChange={setRotation}
                     onCropComplete={(_area: Area, pixels: Area) => setRegion(pixels)}
                     style={{ cropAreaStyle: FRAME_STYLE }}
                  />
               </Suspense>
            </div>

            {/* Control bar: zoom + rotate + reset. */}
            <div className="flex items-center gap-3 border-t border-border px-4 py-3">
               <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
               <PointerSlider value={zoom} min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} onChange={setZoom} label={t('ImageCropper.zoom')} />
               <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
               <IconButton type="button" variant="ghost" size="sm" onClick={() => setRotation((current) => (current + 90) % 360)} aria-label={t('ImageCropper.rotate')} title={t('ImageCropper.rotate')}>
                  <RotateCw className="h-4 w-4" />
               </IconButton>
               <IconButton type="button" variant="ghost" size="sm" onClick={reset} aria-label={t('ImageCropper.reset')} title={t('ImageCropper.reset')}>
                  <RotateCcw className="h-4 w-4" />
               </IconButton>
            </div>

            {tooSmall && <p className="px-4 pb-2 text-sm text-destructive">{t('ImageCropper.tooSmall')}</p>}

            <DialogFooter className="border-t border-border px-4 py-3">
               <Button type="button" variant="outline" onClick={onCancel} className="cursor-pointer">{t('ImageCropper.cancel')}</Button>
               <Button type="button" onClick={accept} disabled={!region || tooSmall || isCutting} className="cursor-pointer">
                  {isCutting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  {t('ImageCropper.apply')}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}

/**
 * A small chip previewing the framed region in the destination's shape. Mirrors the stage's
 * transform: the source sits rotated in its bounding box, and the box is offset + scaled so the
 * region fills the chip. Updates live as the frame moves.
 */
function DestinationPreview({ imageUrl, region, rotation, source, aspect }: {
   imageUrl: string;
   region: CropRegion | null;
   rotation: number;
   source: ImageBitmap;
   aspect: number;
}) {
   const CHIP_HEIGHT = 44;
   const chipWidth = CHIP_HEIGHT * aspect;

   const layout = useMemo(() => {
      if (!region) return null;
      const scale = CHIP_HEIGHT / region.height;
      const radians = (rotation * Math.PI) / 180;
      const sin = Math.abs(Math.sin(radians));
      const cos = Math.abs(Math.cos(radians));
      const boxWidth = source.width * cos + source.height * sin;
      const boxHeight = source.width * sin + source.height * cos;
      return {
         scale,
         boxWidth: boxWidth * scale,
         boxHeight: boxHeight * scale,
         offsetX: -region.x * scale,
         offsetY: -region.y * scale,
         imageWidth: source.width * scale,
         imageHeight: source.height * scale,
      };
   }, [region, rotation, source]);

   return (
      <div
         className="relative shrink-0 overflow-hidden rounded-md border border-border bg-muted"
         style={{ width: chipWidth, height: CHIP_HEIGHT }}
      >
         {layout && (
            <div className="absolute" style={{ left: layout.offsetX, top: layout.offsetY, width: layout.boxWidth, height: layout.boxHeight }}>
               <img
                  src={imageUrl}
                  alt=""
                  className="absolute left-1/2 top-1/2 max-w-none"
                  style={{ width: layout.imageWidth, height: layout.imageHeight, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
               />
            </div>
         )}
      </div>
   );
}
