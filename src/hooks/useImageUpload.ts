// -- React Imports --
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Pipeline / Asset Store --
import { processImage } from '@/lib/assets/processImage';
import { storeAsset } from '@/lib/assets/assetRepository';

/*
 * The shared image-upload pipeline: a hidden file input plus process -> store -> hash, handing back the
 * content hash as the new assetId. Both the Challenge editor dialog and the expanded sheet drive their
 * own image chrome off this one hook so the pipeline lives in a single place. `open` triggers the file
 * picker; `isProcessing` covers the async process/store window for a spinner.
 */
export function useImageUpload(onPicked: (assetId: string) => void) {
   const { t } = useTranslation();
   const [isProcessing, setIsProcessing] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);

   const open = () => fileInputRef.current?.click();

   const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      setIsProcessing(true);
      try {
         const processed = await processImage(file);
         const hash = await storeAsset(processed);
         onPicked(hash);
      } catch {
         toast.error(t('ImageCard.uploadFailed'));
      } finally {
         setIsProcessing(false);
      }
   };

   return { fileInputRef, open, isProcessing, handleFileSelected };
}
