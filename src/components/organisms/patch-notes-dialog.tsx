'use client';

// -- React Imports --
import { useEffect, useState } from 'react';

// -- Next Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { IconButton } from '../ui/icon-button';

// -- Icon Imports --
import { ChevronLeft, ChevronRight } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { patchNotes } from '@/lib/patch-notes';

// -- Component Imports --
import MarkdownContent from '../molecules/markdown-content';

// -- Store and Hook Imports --
import { useAppGeneralStateActions, useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';



interface PatchNotesDialogProps {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
}



export function PatchNotesDialog({ isOpen, onOpenChange }: PatchNotesDialogProps) {
   const { t: t } = useTranslation();
   const [currentIndex, setCurrentIndex] = useState(0);

   const initialPatchNotesVersion = useAppGeneralStateStore((state) => state.initialPatchNotesVersion);
   const { setInitialPatchNotesVersion } = useAppGeneralStateActions();

   const selectedNote = patchNotes[currentIndex];
   const totalNotes = patchNotes.length;

   useEffect(() => {
      if (isOpen) {
         if (initialPatchNotesVersion) {
            const index = patchNotes.findIndex(note => note.version === initialPatchNotesVersion);
            if (index !== -1) {
               setCurrentIndex(index);
            }
            setInitialPatchNotesVersion(null);
         } else {
            setCurrentIndex(0);
         }
      }
   }, [isOpen]);

   const goToPrevious = () => {
      setCurrentIndex(current => (current < totalNotes - 1 ? current + 1 : current));
   };

   const goToNext = () => {
      setCurrentIndex(current => (current > 0 ? current - 1 : current));
   };

   const handleVersionSelect = (version: string) => {
      const index = patchNotes.findIndex(note => note.version === version);
      if (index !== -1) {
         setCurrentIndex(index);
      }
   };



   return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
         <DialogContent className="max-w-xl">
            <DialogHeader>
               <DialogTitle>{t('PatchNotesDialog.title')}</DialogTitle>
               <div className="flex items-center justify-between pt-2">
                  <DialogDescription>{t('PatchNotesDialog.description')}</DialogDescription>
                  <Select value={selectedNote?.version || ''} onValueChange={handleVersionSelect}>
                     <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t('PatchNotesDialog.selectVersion')} />
                     </SelectTrigger>
                     <SelectContent>
                        {patchNotes.map(note => (
                           <SelectItem key={note.version} value={note.version}>
                              {t('PatchNotesDialog.versionLabel')} {note.version}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>
            </DialogHeader>

            <IconButton
               onClick={goToPrevious} 
               disabled={currentIndex === totalNotes - 1}
               aria-label="Previous patch note"
               className={cn(
                  "absolute left-[-3.5rem] top-1/2 -translate-y-1/2 h-10 w-10 transition-all duration-200 ease-in-out cursor-pointer",
               )}
            >
               <ChevronLeft className="w-8 h-8"/>
            </IconButton>

            <div className="mt-4 max-h-[60vh] overflow-y-auto p-1 pr-4">
               { selectedNote?.content && <MarkdownContent content={selectedNote.content} /> }
            </div>

            <IconButton 
               onClick={goToNext} 
               disabled={currentIndex === 0}
               aria-label="Next patch note"
               className={cn(
                  "absolute right-[-3.5rem] top-1/2 -translate-y-1/2 h-10 w-10 transition-all duration-200 ease-in-out cursor-pointer",
               )}
            >
               <ChevronRight className="w-8 h-8"/>
            </IconButton>

            <DialogFooter className="items-end mt-4 sm:justify-between">
               <div className="text-sm text-muted-foreground">
                  {t('PatchNotesDialog.pageCounterLabel')} {`${totalNotes - currentIndex}/${totalNotes}`}
               </div>
               <Button onClick={() => onOpenChange(false)} className="cursor-pointer">{t('PatchNotesDialog.close')}</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}