// -- React Imports --
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { Download, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { ToolbarHandle } from '@/components/molecules/ToolbarHandle';

// -- Store and Hook Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';
import { useToolbarHover } from '@/hooks/useToolbarHover';
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';

// -- Pipeline / Asset Store --
import { processImage } from '@/lib/assets/processImage';
import { storeAsset } from '@/lib/assets/assetRepository';

// -- Type Imports --
import type { Card as CardData, ImageCardDetails } from '@/lib/types/character';
import type { CardComponentProps } from '@/components/organisms/cards/resolveCardComponent';

/*
 * The character portrait card, first consumer of the assets store. Game-agnostic:
 * it renders the same for every game and ignores `details.game`. The empty state
 * (`assetId === null`) is first-class - a persistent placeholder shown in both edit
 * and play mode, doubling as the upload affordance in edit mode. Card-level actions
 * (drag, delete, export) ride the shared ToolbarHandle like any sheet card; the
 * image-specific set/change/remove controls live in the card body.
 */

const ImageCardContent = React.memo(
   React.forwardRef<HTMLDivElement, CardComponentProps>(
      ({ card, isEditing = false, isSnapshot, isDrawerPreview, isMobile = false, dragAttributes, dragListeners, onExport }, ref) => {
         const { t } = useTranslation();
         const actions = useCharacterActions();
         const details = card.details as ImageCardDetails;

         const { isHovered, hoverHandlers } = useToolbarHover(isDrawerPreview);
         const { url, isLoading } = useAssetObjectUrl(details.assetId);
         const [isProcessing, setIsProcessing] = useState(false);
         const fileInputRef = useRef<HTMLInputElement>(null);

         // Static everywhere a snapshot is shown: drag overlay and drawer preview have
         // no controls and never open the picker.
         const interactive = isEditing && !isSnapshot && !isDrawerPreview;
         const showSpinner = isProcessing || (details.assetId !== null && isLoading);

         const openPicker = () => fileInputRef.current?.click();

         const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = ''; // allow re-picking the same file
            if (!file) return;
            setIsProcessing(true);
            try {
               const processed = await processImage(file);
               const hash = await storeAsset(processed);
               actions.setCardImage(card.id, hash);
            } catch {
               toast.error(t('ImageCard.uploadFailed'));
            } finally {
               setIsProcessing(false);
            }
         };

         const altText = card.title || t('ImageCard.alt');

         // Downloads the raw image file (the stored webp), distinct from the .cotm export.
         // Uses the already-loaded object URL; a filesystem-friendly name from the title.
         const downloadName = (card.title.trim() || 'portrait').replace(/[^\w-]+/g, '_');
         const handleDownloadImage = () => {
            if (!url) return;
            const link = document.createElement('a');
            link.href = url;
            link.download = `${downloadName}.webp`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
         };

         const imageArea = (
            <div className="relative h-full w-full bg-muted">
               {showSpinner ? (
                  <div className="flex h-full w-full items-center justify-center">
                     <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
               ) : url ? (
                  <img
                     src={url}
                     alt={altText}
                     title={altText}
                     className={cn('h-full w-full', details.fit === 'contain' ? 'object-contain' : 'object-cover')}
                  />
               ) : interactive ? (
                  <button
                     type="button"
                     onClick={openPicker}
                     className={cn(
                        'flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center',
                        'border-2 border-dashed border-border text-muted-foreground',
                        'hover:text-foreground hover:border-foreground transition-colors cursor-pointer',
                     )}
                  >
                     <Upload className={cn(isDrawerPreview ? 'h-6 w-6' : 'h-10 w-10')} />
                     <span className={cn('font-semibold', isDrawerPreview ? 'text-sm' : 'text-xl')}>{t('ImageCard.upload')}</span>
                  </button>
               ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center text-muted-foreground">
                     <ImageIcon className={cn(isDrawerPreview ? 'h-6 w-6' : 'h-10 w-10')} />
                     <span className={cn('font-semibold', isDrawerPreview ? 'text-sm' : 'text-xl')}>{t('ImageCard.empty')}</span>
                  </div>
               )}

               {/* On-image controls. Change/Remove are edit-only; the raw-image download
                   is available in play mode too, revealed on hover so it never covers the
                   art (edit mode keeps them all visible). */}
               {url && !showSpinner && !isSnapshot && !isDrawerPreview && (interactive || isHovered) && (
                  <div className="absolute right-2 top-2 flex gap-1">
                     {interactive && (
                        <Button
                           variant="secondary"
                           size="icon"
                           className="h-8 w-8 cursor-pointer opacity-90"
                           title={t('ImageCard.change')}
                           onClick={openPicker}
                        >
                           <Upload className="h-4 w-4" />
                        </Button>
                     )}
                     {interactive && (
                        <Button
                           variant="destructive"
                           size="icon"
                           className="h-8 w-8 cursor-pointer opacity-90"
                           title={t('ImageCard.remove')}
                           onClick={() => actions.setCardImage(card.id, null)}
                        >
                           <Trash2 className="h-4 w-4" />
                        </Button>
                     )}
                     <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 cursor-pointer opacity-90"
                        title={t('ImageCard.download')}
                        onClick={handleDownloadImage}
                     >
                        <Download className="h-4 w-4" />
                     </Button>
                  </div>
               )}
            </div>
         );

         return (
            <motion.div ref={ref} {...hoverHandlers} className="relative">
               {!isDrawerPreview && !isSnapshot && (
                  <ToolbarHandle
                     isEditing={isEditing}
                     isHovered={isHovered}
                     dragAttributes={dragAttributes}
                     dragListeners={dragListeners}
                     onDelete={() => actions.deleteCard(card.id)}
                     onExport={onExport}
                     cardTheme="card-type-image"
                  />
               )}
               <Card
                  className={cn(
                     isMobile ? 'w-full h-full' : isDrawerPreview ? 'w-62.5 h-30' : 'w-62.5 h-150',
                     'flex flex-col border-2 shadow-lg p-0 overflow-hidden gap-0 relative z-0',
                     'border-card-accent card-type-image',
                     { 'shadow-none pointer-events-none border-card-border': isDrawerPreview },
                  )}
               >
                  {imageArea}
               </Card>

               <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelected}
               />
            </motion.div>
         );
      },
   ),
);
ImageCardContent.displayName = 'ImageCardContent';



export const ImageCard: React.NamedExoticComponent<CardComponentProps & React.RefAttributes<HTMLDivElement>> = React.memo(
   React.forwardRef<HTMLDivElement, CardComponentProps>((props, ref) => {
      if ((props.card as CardData).cardType !== 'IMAGE_CARD') return null;
      return <ImageCardContent {...props} ref={ref} />;
   }),
);
ImageCard.displayName = 'ImageCard';
