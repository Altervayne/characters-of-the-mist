/*
 * Cuts a crop region out of a decoded image and returns the raw pixels as a Blob.
 * Crop-ONLY: no resize, no target-size encode. The clamp-to-1024 + webp step lives
 * downstream in {@link processImage}, which is the sole authority on the stored bytes;
 * a second lossy encode here would be webp-of-webp. Output is PNG so the crop stays
 * lossless and `processImage`'s single webp pass is the only lossy step.
 *
 * The region is expressed in the coordinate space of the ROTATED image (the bounding
 * box of the source turned by `rotation`), which is exactly what react-easy-crop reports
 * as `croppedAreaPixels`. So the cut mirrors the stage: rotate the source into its bounding
 * box, then lift the region out of it.
 */

/** A crop rectangle in the rotated image's pixel space, matching react-easy-crop's `croppedAreaPixels`. */
export interface CropRegion {
   x: number;
   y: number;
   width: number;
   height: number;
}

/** Draws `canvas` to a PNG blob (lossless), rejecting if the encoder yields nothing. */
function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
   return new Promise((resolve, reject) => {
      canvas.toBlob(
         (blob) => (blob ? resolve(blob) : reject(new Error('Canvas crop encoding produced no blob'))),
         'image/png',
      );
   });
}

/** Acquires a 2D context, throwing on the (unexpected) allocation failure. */
function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
   const context = canvas.getContext('2d');
   if (!context) throw new Error('Could not acquire a 2D canvas context for cropping');
   return context;
}

/**
 * Cuts `region` out of `source`, honoring `rotation` (degrees). Draws the source into
 * its rotated bounding box, then extracts the region into an output canvas at 1:1 pixels.
 *
 * @param source - The decoded, EXIF-oriented source image.
 * @param region - The crop rectangle in the rotated image's pixel space.
 * @param rotation - Clockwise rotation in degrees (0, 90, 180, 270).
 * @returns The cropped pixels as a lossless PNG blob, ready for {@link processImage}.
 */
export async function cropImage(
   source: ImageBitmap,
   region: CropRegion,
   rotation: number,
): Promise<Blob> {
   const radians = (rotation * Math.PI) / 180;
   const sin = Math.abs(Math.sin(radians));
   const cos = Math.abs(Math.cos(radians));
   const boxWidth = source.width * cos + source.height * sin;
   const boxHeight = source.width * sin + source.height * cos;

   // The rotated source, centered in its own bounding box.
   const stage = document.createElement('canvas');
   stage.width = Math.round(boxWidth);
   stage.height = Math.round(boxHeight);
   const stageContext = context2d(stage);
   stageContext.translate(stage.width / 2, stage.height / 2);
   stageContext.rotate(radians);
   stageContext.drawImage(source, -source.width / 2, -source.height / 2);

   // Lift the region out at 1:1.
   const output = document.createElement('canvas');
   output.width = Math.round(region.width);
   output.height = Math.round(region.height);
   context2d(output).drawImage(
      stage,
      Math.round(region.x),
      Math.round(region.y),
      output.width,
      output.height,
      0,
      0,
      output.width,
      output.height,
   );

   return canvasToPngBlob(output);
}
