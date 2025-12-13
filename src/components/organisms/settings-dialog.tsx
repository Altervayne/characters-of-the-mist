'use client';

// -- React Imports --
import React, { useState } from 'react';

// -- Next Imports --
import { useTheme } from 'next-themes';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

// -- Other Library Imports --
import toast from 'react-hot-toast';
import { Separator } from '@radix-ui/react-select';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '../ui/input';

// -- Icon Imports --
import { Sun, Moon, BookOpen, FlipHorizontal, AlertTriangle, Trash2, OctagonMinus, DatabaseBackup, PlayCircle, Lock, UnlockIcon } from 'lucide-react';

// -- Component Imports --
import { MigrationDialog } from './migration-dialog';

// -- Store and Hook Imports --
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useCharacterStore } from '@/lib/stores/characterStore';
import { useDrawerStore } from '@/lib/stores/drawerStore';



const locales = [
   { code: 'en', name: 'English' },
   { code: 'fr', name: 'Français' },
];



// ###################################
// ###   ALERT DIALOG COMPONENTS   ###
// ###################################

interface ConfirmationDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   onConfirm: () => void;
   title: string;
   description: string;
   confirmationText: string;
   confirmButtonText: string;
}

function ConfirmationDialog({ open, onOpenChange, onConfirm, title, description, confirmationText, confirmButtonText }: ConfirmationDialogProps) {
   const t = useTranslations('SettingsDialog');
   const [input, setInput] = useState("");

   const handleOpenChange = (isOpen: boolean) => {
      onOpenChange(isOpen);
      if (!isOpen) {
         setInput("");
      }
   };

   return (
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
         <AlertDialogContent className="border-2 border-dashed border-destructive">
            <AlertDialogHeader>
               <div className="flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
                  <AlertDialogTitle>{title}</AlertDialogTitle>
               </div>
               <AlertDialogDescription>
                  {description}
                  <p className="mt-2 text-foreground">
                     {t('dangerZone.resetDialog.confirmationPrompt')} <strong className="text-destructive"></strong>
                  </p>
                  <p className="w-full mt-1 text-center text-sm font-bold text-destructive">{confirmationText}</p>
               </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
               value={input}
               onChange={(e) => setInput(e.target.value)}
               placeholder={confirmationText}
               className="border-foreground/50"
            />
            <AlertDialogFooter>
               <AlertDialogCancel className="cursor-pointer">{t('dangerZone.resetDialog.cancel')}</AlertDialogCancel>
               <AlertDialogAction
                  onClick={onConfirm}
                  disabled={input !== confirmationText}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
               >
                  {confirmButtonText}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   );
}



// ####################################
// ###   MAIN SETTINGS DIALOG   ###
// ####################################

interface SettingsDialogProps {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
   onStartTour: () => void;
}



export function SettingsDialog({ isOpen, onOpenChange, onStartTour }: SettingsDialogProps) {
   const t = useTranslations('SettingsDialog');
   const tNotifications = useTranslations('Notifications')
   const locale = useLocale();
   const router = useRouter();
   const pathname = usePathname();

   const { resolvedTheme, setTheme: setMode } = useTheme(); 
   
   const { theme: colorTheme, isSideBySideView, isTrackersAlwaysEditable } = useAppSettingsStore();
   const { setTheme: setColorTheme, setSideBySideView, setTrackersAlwaysEditable, setLocale } = useAppSettingsActions();

   const colorThemeOptions = ['theme-neutral', 'theme-legends', 'theme-otherscape', 'theme-city-of-mist'];

   const [isResetAppDialogOpen, setIsResetAppDialogOpen] = useState(false);
   const [isDeleteDrawerDialogOpen, setIsDeleteDrawerDialogOpen] = useState(false);
   const [isMigrationDialogOpen, setIsMigrationDialogOpen] = useState(false);

   const handleAppReset = () => {
      useCharacterStore.persist.clearStorage();
      useDrawerStore.persist.clearStorage();
      useAppSettingsStore.persist.clearStorage();
      setTimeout(() => window.location.reload(), 500);
      toast.success(tNotifications('general.appReset'));
   };

   const handleDeleteDrawer = () => {
      useDrawerStore.persist.clearStorage();
      setTimeout(() => window.location.reload(), 500);
      toast.success(tNotifications('drawer.deleted'));
   }

   const handleLocaleChange = (newLocale: string) => {
      setLocale(newLocale);
      const segments = pathname.split('/');
      segments[1] = newLocale;
      router.replace(segments.join('/'));
   };

   
   
   return (
      <>
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>

               <DialogHeader>
                  <DialogTitle>{t('title')}</DialogTitle>
                  <DialogDescription>{t('description')}</DialogDescription>
               </DialogHeader>


               <div className="grid gap-6 py-4">
                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label htmlFor="language-select" className="text-left">
                        {t('language')}
                     </Label>
                     <Select value={locale} onValueChange={handleLocaleChange}>
                        <SelectTrigger id="language-select" className="col-span-2 cursor-pointer">
                           <SelectValue placeholder="Select a language" />
                        </SelectTrigger>
                        <SelectContent>
                           {locales.map((loc) => (
                              <SelectItem key={loc.code} value={loc.code}>
                                 {loc.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label htmlFor="theme-select" className="text-left">{t('accentColor')}</Label>
                     <Select value={colorTheme} onValueChange={setColorTheme}>
                        <SelectTrigger id="theme-select" className="col-span-2 cursor-pointer">
                           <SelectValue placeholder="Select a theme" />
                        </SelectTrigger>
                        <SelectContent>
                           {colorThemeOptions.map(themeName => (
                              <SelectItem key={themeName} value={themeName} className="cursor-pointer">
                                 {themeName.replace('theme-', '').charAt(0).toUpperCase() + themeName.slice(7)}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label className="text-left">{t('appearance')}</Label>
                     <div className="col-span-2 flex items-center gap-2">
                        <Button
                           variant={resolvedTheme === 'light' ? 'default' : 'outline'}
                           onClick={() => setMode('light')}
                           className="flex-1 w-full cursor-pointer"
                        >
                           <Sun className="mr-2 h-4 w-4" /> {t('light')}
                        </Button>
                        <Button
                           variant={resolvedTheme === 'dark' ? 'default' : 'outline'}
                           onClick={() => setMode('dark')}
                           className="flex-1 w-full cursor-pointer"
                        >
                           <Moon className="mr-2 h-4 w-4" /> {t('dark')}
                        </Button>
                     </div>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label className="text-left">{t('cardView.title')}</Label>
                     <div className="col-span-2 flex items-center space-x-2">
                        <Button
                           variant={!isSideBySideView ? 'default' : 'outline'}
                           onClick={() => setSideBySideView(false)}
                           className="flex-1 w-full cursor-pointer text-wrap"
                        >
                           <FlipHorizontal className="mr-2 h-4 w-4" /> {t('cardView.flipping')}
                        </Button>
                        <Button
                           variant={isSideBySideView ? 'default' : 'outline'}
                           onClick={() => setSideBySideView(true)}
                           className="flex-1 w-full cursor-pointer text-wrap"
                        >
                           <BookOpen className="mr-2 h-4 w-4" /> {t('cardView.sideBySide')}
                        </Button>
                     </div>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label className="text-left">{t('trackerEdit.title')}</Label>
                     <div className="col-span-2 flex items-center space-x-2">
                        <Button
                           variant={!isTrackersAlwaysEditable ? 'default' : 'outline'}
                           onClick={() => setTrackersAlwaysEditable(false)}
                           className="flex-1 w-full cursor-pointer text-wrap"
                        >
                           <UnlockIcon className="mr-2 h-4 w-4" /> {t('trackerEdit.unlocked')}
                        </Button>
                        <Button
                           variant={isTrackersAlwaysEditable ? 'default' : 'outline'}
                           onClick={() => setTrackersAlwaysEditable(true)}
                           className="flex-1 w-full cursor-pointer text-wrap"
                        >
                           <Lock className="mr-2 h-4 w-4" /> {t('trackerEdit.locked')}
                        </Button>
                     </div>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label className="text-left">{t('migration.label')}</Label>
                     <Button onClick={() => setIsMigrationDialogOpen(true)} className="col-span-2 cursor-pointer">
                        <DatabaseBackup className="mr-2 h-4 w-4" />
                        {t('migration.button')}
                     </Button>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label className="text-left">{t('tutorial')}</Label>
                     <Button onClick={onStartTour} className="col-span-2 cursor-pointer">
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {t('tutorialButton')}
                     </Button>
                  </div>
               </div>

               <Separator />

               <div className="space-y-4 rounded-lg border-2 border-destructive bg-destructive/5 p-4">
                  <div className="flex items-center gap-4">
                     <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
                     <div>
                        <h3 className="font-semibold">{t('dangerZone.title')}</h3>
                        <p className="text-sm text-muted-foreground">{t('dangerZone.description')}</p>
                     </div>
                  </div>

                  <div className="flex gap-2">
                     <Button
                        variant="destructive"
                        className="cursor-pointer flex-grow flex-1"
                        onClick={() => setIsDeleteDrawerDialogOpen(true)}
                     >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('dangerZone.deleteDrawerButton')}
                     </Button>
                     <Button
                        variant="destructive"
                        className="cursor-pointer flex-grow flex-1"
                        onClick={() => setIsResetAppDialogOpen(true)}
                     >
                        <OctagonMinus className="mr-2 h-4 w-4" />
                        {t('dangerZone.resetButton')}
                     </Button>
                  </div>
               </div>


            </DialogContent>
         </Dialog>

         <MigrationDialog
            isOpen={isMigrationDialogOpen}
            onOpenChange={setIsMigrationDialogOpen}
         />

         <ConfirmationDialog
            open={isDeleteDrawerDialogOpen}
            onOpenChange={setIsDeleteDrawerDialogOpen}
            onConfirm={handleDeleteDrawer}
            title={t('dangerZone.deleteDrawerDialog.title')}
            description={t('dangerZone.deleteDrawerDialog.description')}
            confirmationText="DELETE DRAWER"
            confirmButtonText={t('dangerZone.deleteDrawerDialog.confirm')}
         />

         <ConfirmationDialog
            open={isResetAppDialogOpen}
            onOpenChange={setIsResetAppDialogOpen}
            onConfirm={handleAppReset}
            title={t('dangerZone.resetDialog.title')}
            description={t('dangerZone.resetDialog.description')}
            confirmationText="DELETE ALL MY APP DATA"
            confirmButtonText={t('dangerZone.resetDialog.confirm')}
         />
      </>
   );
}