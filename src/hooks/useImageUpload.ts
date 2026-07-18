// -- React Imports --
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Pipeline / Asset Store --
import { processImage } from '@/lib/assets/processImage';
import { storeAsset } from '@/lib/assets/assetRepository';

// -- Crop Step --
import { useImageCropper, type CropAspect } from '@/hooks/useImageCropper';

/*
 * The shared image-upload pipeline: a hidden file input plus crop -> process -> store -> hash, handing
 * back the content hash as the new assetId. The picked file first goes through the crop dialog (framed to
 * the destination `aspect`); its cut blob is what the pipeline processes and stores, so the pipeline still
 * lives in one place. `open` triggers the file picker; render `cropperDialog` alongside the input so the
 * crop stage can mount; `isProcessing` covers the async process/store window for a spinner.
 */
export function useImageUpload(onPicked: (assetId: string) => void, options?: { aspect?: CropAspect }) {
   const { t } = useTranslation();
   const [isProcessing, setIsProcessing] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const cropper = useImageCropper();

   const open = () => fileInputRef.current?.click();

   const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      let cropped: Blob | null;
      try {
         cropped = await cropper.open(file, { aspect: options?.aspect ?? 'free' });
      } catch {
         toast.error(t('ImageCard.uploadFailed'));
         return;
      }
      if (!cropped) return; // cancelled or unsupported file - leave state untouched

      setIsProcessing(true);
      try {
         const processed = await processImage(cropped);
         const hash = await storeAsset(processed);
         onPicked(hash);
      } catch {
         toast.error(t('ImageCard.uploadFailed'));
      } finally {
         setIsProcessing(false);
      }
   };

   return { fileInputRef, open, isProcessing, handleFileSelected, cropperDialog: cropper.dialog };
}
