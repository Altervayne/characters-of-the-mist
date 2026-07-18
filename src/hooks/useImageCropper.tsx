// -- React Imports --
import { useCallback, useState } from 'react';

// -- Component Imports --
import { ImageCropperDialog } from '@/components/molecules/ImageCropperDialog';

/*
 * A promise-returning crop step that sits between a file pick and the asset pipeline. `open`
 * decodes the file (EXIF-oriented, so phone photos never import sideways), mounts the crop dialog,
 * and resolves with the cut blob - or `null` when the user cancels. It resolves nothing until the
 * dialog settles, so a caller can `await` it inline. The mounted dialog is returned as `dialog`
 * for the consumer to render; a non-image file resolves `null` without opening it.
 */

/** The destination framing for a crop: a locked width/height ratio, or the whole image. */
export type CropAspect = number | 'free';

interface CropperSession {
   bitmap: ImageBitmap;
   previewUrl: string;
   aspect: CropAspect;
   resolve: (blob: Blob | null) => void;
}

export interface UseImageCropper {
   /** Opens the crop dialog for `file`; resolves the cut blob, or `null` on cancel. Rejects if the image can't decode. */
   open: (file: File, options: { aspect: CropAspect }) => Promise<Blob | null>;
   /** The mounted dialog while a crop is in progress, else `null`; render it near the file input. */
   dialog: React.ReactNode;
}

export function useImageCropper(): UseImageCropper {
   const [session, setSession] = useState<CropperSession | null>(null);

   const open = useCallback((file: File, options: { aspect: CropAspect }): Promise<Blob | null> => {
      if (!file.type.startsWith('image/')) return Promise.resolve(null);
      return new Promise<Blob | null>((resolve, reject) => {
         createImageBitmap(file, { imageOrientation: 'from-image' })
            .then((bitmap) => {
               setSession({ bitmap, previewUrl: URL.createObjectURL(file), aspect: options.aspect, resolve });
            })
            .catch(reject);
      });
   }, []);

   // Closes out the active session: release the decode, clear the dialog, resolve the caller.
   const settle = (current: CropperSession, result: Blob | null) => {
      current.bitmap.close();
      URL.revokeObjectURL(current.previewUrl);
      setSession(null);
      current.resolve(result);
   };

   const dialog = session ? (
      <ImageCropperDialog
         key={session.previewUrl}
         imageUrl={session.previewUrl}
         bitmap={session.bitmap}
         aspect={session.aspect}
         onCancel={() => settle(session, null)}
         onComplete={(blob) => settle(session, blob)}
      />
   ) : null;

   return { open, dialog };
}
