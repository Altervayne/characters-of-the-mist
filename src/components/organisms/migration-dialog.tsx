'use client';

// -- React Imports --
import React, { useState, useCallback } from 'react';

// -- Next Imports --
import { useTranslations } from 'next-intl';

// -- Other Library Imports --
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// -- Icon Imports --
import { HardDriveUpload, File, X, Heart } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { transformLegacyCharacter } from '@/lib/utils/migration';
import { findFolder } from '@/lib/utils/drawer';

// -- Store and Hook Imports --
import { useDrawerActions, useDrawerStore } from '@/lib/stores/drawerStore';



interface MigrationDialogProps {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
}



export const MigrationDialog: React.FC<MigrationDialogProps> = ({ isOpen, onOpenChange }) => {
   const t = useTranslations('MigrationDialog');
   const tNotifications = useTranslations('Notifications');
   const [files, setFiles] = useState<File[]>([]);

   const { addFolder, addItem } = useDrawerActions();

   const onDrop = useCallback((acceptedFiles: File[]) => {
      setFiles(prevFiles => {
         const newFiles = acceptedFiles.filter(
            (newFile) => !prevFiles.some(
               (existingFile) => existingFile.name === newFile.name && existingFile.size === newFile.size
            )
         );
         return [...prevFiles, ...newFiles];
      });
   }, []);

   const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      accept: { 'application/json': ['.json'] },
      multiple: true,
   });

   const handleRemoveFile = (fileToRemove: File) => {
      setFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove));
   };



   const getOrCreateFolder = (name: string, parentId?: string): Promise<string> => {
      return new Promise((resolve, reject) => {
         const state = useDrawerStore.getState();
         const parentFolder = parentId ? findFolder(state.drawer.folders, parentId) : null;
         const searchScope = parentFolder ? parentFolder.folders : state.drawer.folders;
         const existingFolder = searchScope.find(f => f.name === name);

         if (existingFolder) {
            resolve(existingFolder.id);
            return;
         }

         const unsubscribe = useDrawerStore.subscribe((newState) => {
            const newParentFolder = parentId ? findFolder(newState.drawer.folders, parentId) : null;
            const newSearchScope = newParentFolder ? newParentFolder.folders : newState.drawer.folders;
            const newFolder = newSearchScope.find(f => f.name === name);

            if (newFolder) {
               unsubscribe();
               resolve(newFolder.id);
            }
         });

         addFolder(name, parentId);

         setTimeout(() => {
            unsubscribe();
            reject(new Error(`Folder "${name}" creation timed out.`));
         }, 2000);
      });
   };



   const handleMigrate = async () => {
      if (files.length === 0) return;
      let successCount = 0;

      try {
         const migrationRootFolderId = await getOrCreateFolder("MIGRATION");

         const migrationPromises = files.map(async (file) => {
            try {
               const fileContent = await file.text();
               const legacyData = JSON.parse(fileContent);

               const { character, deconstructedCards, deconstructedTrackers } = transformLegacyCharacter(legacyData);

               const today = new Date().toISOString().split('T')[0];
               const characterFolderName = `${character.name} - ${today}`;
               const characterFolderId = await getOrCreateFolder(characterFolderName, migrationRootFolderId);

               addItem(character.name, character.game, 'FULL_CHARACTER_SHEET', character, characterFolderId);

               if (deconstructedCards.length > 0) {
                  const cardsFolderId = await getOrCreateFolder("Cards", characterFolderId);
                  deconstructedCards.forEach(card => {
                     addItem(card.title, character.game, card.cardType, card, cardsFolderId);
                  });
               }

               if (deconstructedTrackers.length > 0) {
                  const trackersFolderId = await getOrCreateFolder("Trackers", characterFolderId);
                  deconstructedTrackers.forEach(tracker => {
                     addItem(tracker.name, character.game, 'STATUS_TRACKER', tracker, trackersFolderId);
                  });
               }

               successCount++;
            } catch (error: unknown) {
               if (error instanceof Error && error.message === 'UNSUPPORTED_GAME_SYSTEM') {
                  toast.error(tNotifications('migration.unsupported'));
               } else {
                  toast.error(tNotifications('migration.failed'));
               }
               console.error(`Failed to migrate ${file.name}:`, error);
            }
        });

        await Promise.all(migrationPromises);

        if (successCount > 0) {
            toast.success(tNotifications('migration.success'));
        }
      } catch (error: unknown) {
         toast.error(tNotifications('migration.folderError'));
         console.error("Migration failed:", error);
      }

      setFiles([]);
      onOpenChange(false);
   };

   const handleOpenChange = (open: boolean) => {
      if (!open) {
         setFiles([]);
      }
      onOpenChange(open);
   };



   return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
         <DialogContent>
            <DialogHeader>
               <DialogTitle>{t('title')}</DialogTitle>
               <DialogDescription>{t('description')}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col p-4 bg-muted/50 rounded-md mt-4">
               <DialogDescription>{t('thankYou')}</DialogDescription>
               <span className="flex items-center p-1 gap-2 mt-1">
                  <p className="w-full text-end">{`- Altervayne²`}</p>
                  <Heart/>
               </span>
            </div>

            <div className="py-4 space-y-3">
               <div
                  {...getRootProps()}
                  className={cn(
                     "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors",
                     {
                        "border-primary bg-muted": isDragActive,
                        "border-border hover:border-primary/50": !isDragActive,
                     }
                  )}
               >
                  <input {...getInputProps()} />
                  <HardDriveUpload className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-center">
                     {isDragActive ? t('dropzone.active') : t('dropzone.inactive')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{t('dropzone.fileTypes')}</p>
               </div>

               {files.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                     {files.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center justify-between p-2 rounded-md border">
                           <div className="flex items-center gap-2 overflow-hidden">
                           <File className="h-5 w-5 flex-shrink-0" />
                           <span className="font-mono text-sm truncate" title={file.name}>{file.name}</span>
                           </div>
                           <Button variant="ghost" size="icon" onClick={() => handleRemoveFile(file)}>
                           <X className="h-4 w-4" />
                           </Button>
                        </div>
                     ))}
                  </div>
               )}
            </div>

            <DialogFooter>
               <Button variant="ghost" onClick={() => handleOpenChange(false)} className="cursor-pointer">{t('cancel')}</Button>
               <Button onClick={handleMigrate} disabled={files.length === 0} className="cursor-pointer">{t('migrateButton')}</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
};