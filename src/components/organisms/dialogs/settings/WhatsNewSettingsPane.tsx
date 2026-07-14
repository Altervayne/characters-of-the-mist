// -- React Imports --
import { useEffect, useState, startTransition } from 'react';
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconButton } from '@/components/ui/icon-button';

// -- Icon Imports --
import { ChevronLeft, ChevronRight } from 'lucide-react';

// -- Utils Imports --
import { patchNotes, latestPatchNotesVersion } from '@/lib/patch-notes';

// -- Component Imports --
import MarkdownContent from '@/components/molecules/MarkdownContent';

// -- Store and Hook Imports --
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';



/**
 * The What's-new section: the release notes, folded out of the old PatchNotesDialog. The version Select and the
 * one-shot `initialPatchNotesVersion` deep-link carry over verbatim; the dialog's floating chevrons become an
 * in-pane footer (prev / counter / next), mirroring MobilePatchNotes. Opening the pane marks the newest release
 * read, so the New! dot clears. The pane mounts only when its section is active (Radix unmounts inactive tabs),
 * so both the deep-link seed and the mark-read fire exactly when the user lands here.
 */
export function WhatsNewSettingsPane() {
   const { t } = useTranslation();
   const [currentIndex, setCurrentIndex] = useState(0);

   const initialPatchNotesVersion = useAppGeneralStateStore((state) => state.initialPatchNotesVersion);
   const { setInitialPatchNotesVersion } = useAppGeneralStateActions();
   const { setLastReadPatchNotesVersion } = useAppSettingsActions();

   const selectedNote = patchNotes[currentIndex];
   const totalNotes = patchNotes.length;

   // Landing here IS reading the notes: clear the New! dot by marking the newest release read.
   useEffect(() => {
      setLastReadPatchNotesVersion(latestPatchNotesVersion);
   }, [setLastReadPatchNotesVersion]);

   // Honor a one-shot deep-link target (boot auto-open or a palette jump), then clear it; otherwise open on the newest.
   useEffect(() => {
      startTransition(() => {
         if (initialPatchNotesVersion) {
            const index = patchNotes.findIndex((note) => note.version === initialPatchNotesVersion);
            if (index !== -1) {
               setCurrentIndex(index);
            }
            setInitialPatchNotesVersion(null);
         } else {
            setCurrentIndex(0);
         }
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps -- seed the note only when the pane mounts
   }, []);

   const goToPrevious = () => {
      setCurrentIndex((current) => (current < totalNotes - 1 ? current + 1 : current));
   };

   const goToNext = () => {
      setCurrentIndex((current) => (current > 0 ? current - 1 : current));
   };

   const handleVersionSelect = (version: string) => {
      const index = patchNotes.findIndex((note) => note.version === version);
      if (index !== -1) {
         setCurrentIndex(index);
      }
   };

   return (
      <div className="flex h-full flex-col gap-4">
         <div className="flex shrink-0 items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">{t('PatchNotesDialog.description')}</p>
            <Select value={selectedNote?.version || ''} onValueChange={handleVersionSelect}>
               <SelectTrigger className="w-45 shrink-0">
                  <SelectValue placeholder={t('PatchNotesDialog.selectVersion')} />
               </SelectTrigger>
               <SelectContent>
                  {patchNotes.map((note) => (
                     <SelectItem key={note.version} value={note.version}>
                        {t('PatchNotesDialog.versionLabel')} {note.version}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </div>

         <div className="min-h-0 flex-1 overflow-y-auto p-1 pr-4">
            {selectedNote?.content && <MarkdownContent content={selectedNote.content} />}
         </div>

         {/* In-pane footer: prev / counter / next, replacing the dialog's floating chevrons. */}
         <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border pt-3">
            <IconButton
               onClick={goToPrevious}
               disabled={currentIndex === totalNotes - 1}
               aria-label={t('PatchNotesDialog.previousNote')}
               variant="outline"
               className="h-10 w-10 cursor-pointer"
            >
               <ChevronLeft className="h-6 w-6" />
            </IconButton>

            <div className="text-sm text-muted-foreground">
               {t('PatchNotesDialog.pageCounterLabel')} {`${totalNotes - currentIndex}/${totalNotes}`}
            </div>

            <IconButton
               onClick={goToNext}
               disabled={currentIndex === 0}
               aria-label={t('PatchNotesDialog.nextNote')}
               variant="outline"
               className="h-10 w-10 cursor-pointer"
            >
               <ChevronRight className="h-6 w-6" />
            </IconButton>
         </div>
      </div>
   );
}
