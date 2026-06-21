// -- React Imports --
import { useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Icon Imports --
import { Image as ImageIcon, Loader2, Scaling, Trash2, Upload } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Store and Hook Imports --
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';

// -- Pipeline / Asset Store --
import { processImage } from '@/lib/assets/processImage';
import { storeAsset } from '@/lib/assets/assetRepository';

// -- Type Imports --
import type { BoardItemContent, ImageBoardContent } from '@/lib/types/board';

/*
 * An image board item. It reuses the asset MACHINERY (processImage -> storeAsset ->
 * useAssetObjectUrl), not the character `ImageCard` component: this image lives in its
 * own freeform box and fills it (`object-cover`/`object-contain` per `fit`). Resize is
 * the canvas's handles. Every change goes through `updateItemContent` (undoable).
 */

interface ImageItemProps {
   content: ImageBoardContent;
   isSelected: boolean;
   onContentChange: (content: BoardItemContent) => void;
   onRequestSelect: () => void;
}

export function ImageItem({ content, isSelected, onContentChange, onRequestSelect }: ImageItemProps) {
   const { t } = useTranslation();
   const { url, isLoading } = useAssetObjectUrl(content.assetId);
   const [isProcessing, setIsProcessing] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);

   const showSpinner = isProcessing || (content.assetId !== null && isLoading);
   const openPicker = () => fileInputRef.current?.click();

   const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = ''; // allow re-picking the same file
      if (!file) return;
      setIsProcessing(true);
      try {
         const processed = await processImage(file);
         const hash = await storeAsset(processed);
         onContentChange({ kind: 'image', assetId: hash, fit: content.fit });
      } catch {
         toast.error(t('BoardView.imageUploadFailed'));
      } finally {
         setIsProcessing(false);
      }
   };

   const toggleFit = () => onContentChange({ kind: 'image', assetId: content.assetId, fit: content.fit === 'cover' ? 'contain' : 'cover' });
   const removeImage = () => onContentChange({ kind: 'image', assetId: null, fit: content.fit });

   return (
      <div className="relative h-full w-full bg-muted">
         {showSpinner ? (
            <div className="flex h-full w-full items-center justify-center">
               <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
         ) : url ? (
            <img src={url} alt="" draggable={false} className={cn('h-full w-full', content.fit === 'contain' ? 'object-contain' : 'object-cover')} />
         ) : (
            // A padding frame stays part of the draggable body so an empty image box can
            // still be moved (the upload button itself stops pointer propagation).
            <div className="h-full w-full p-2">
               <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                     onRequestSelect();
                     openPicker();
                  }}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border p-3 text-center text-muted-foreground hover:border-foreground hover:text-foreground transition-colors cursor-pointer"
               >
                  <Upload className="h-7 w-7" />
                  <span className="text-sm font-medium">{t('BoardView.imageUpload')}</span>
               </button>
            </div>
         )}

         {/* On-image controls, shown only when the item is selected. */}
         {url && !showSpinner && isSelected && (
            <div className="absolute right-1 top-1 flex gap-1">
               <ImageControl title={t('BoardView.imageToggleFit')} onClick={toggleFit}>
                  <Scaling className="h-3.5 w-3.5" />
               </ImageControl>
               <ImageControl title={t('BoardView.imageChange')} onClick={openPicker}>
                  <ImageIcon className="h-3.5 w-3.5" />
               </ImageControl>
               <ImageControl title={t('BoardView.imageRemove')} destructive onClick={removeImage}>
                  <Trash2 className="h-3.5 w-3.5" />
               </ImageControl>
            </div>
         )}

         <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
      </div>
   );
}

/** A small on-image control; stops the drag so the click lands reliably under pointer capture. */
function ImageControl({
   title,
   destructive = false,
   onClick,
   children,
}: {
   title: string;
   destructive?: boolean;
   onClick: () => void;
   children: React.ReactNode;
}) {
   return (
      <button
         type="button"
         title={title}
         aria-label={title}
         onPointerDown={(event: ReactPointerEvent) => event.stopPropagation()}
         onClick={onClick}
         className={cn(
            'flex items-center justify-center rounded p-1 opacity-90 shadow-sm cursor-pointer',
            destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
         )}
      >
         {children}
      </button>
   );
}
