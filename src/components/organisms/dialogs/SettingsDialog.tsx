// -- React Imports --
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';
import { Separator } from '@radix-ui/react-select';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

// -- Icon Imports --
import { Sun, Moon, BookOpen, FlipHorizontal, AlertTriangle, Trash2, OctagonMinus, DatabaseBackup, PlayCircle, Lock, UnlockIcon, Navigation, Menu, HardDrive, Palette } from 'lucide-react';

// -- Component Imports --
import { MigrationDialog } from '@/components/organisms/dialogs/MigrationDialog';
import { LegacyDrawerBackupDialog } from '@/components/organisms/dialogs/LegacyDrawerBackupDialog';
import { LegacyCharacterBackupDialog } from '@/components/organisms/dialogs/LegacyCharacterBackupDialog';

// -- Theme Imports --
import { PRESET_LABELS, customThemeClass } from '@/lib/theme/themeTokens';

// -- Store and Hook Imports --
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { clearAllCharacterData } from '@/lib/character/characterRepository';
import { clearAllAssets } from '@/lib/assets/assetRepository';
import { clearAllBoards } from '@/lib/board/boardRepository';
import { runSweep, estimateStorageUsage } from '@/lib/assets/assetGarbageCollector';
import { clearWorkspace } from '@/lib/character/workspaceSession';
import { clearAllDrawerData } from '@/lib/drawer/drawerRepository';
import { drawerCommandEngine } from '@/lib/drawer/drawerCommandEngine';
import { getLegacyBlobRemovalState } from '@/lib/drawer/runDrawerMigration';
import { getCharacterLegacyBlobRemovalState } from '@/lib/character/runCharacterMigration';
import { useLegacyBlobRemovable } from '@/hooks/useLegacyBlobRemovable';
import { useDeviceType } from '@/hooks/useDeviceType';



const locales = [
   { code: 'en', name: 'English' },
   { code: 'fr', name: 'Français' },
   { code: 'de', name: 'Deutsch' },
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
   const { t } = useTranslation();
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
                  <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
                  <AlertDialogTitle>{title}</AlertDialogTitle>
               </div>
               <AlertDialogDescription>
                  {description}
                  <p className="mt-2 text-foreground">
                     {t('SettingsDialog.dangerZone.resetDialog.confirmationPrompt')} <strong className="text-destructive"></strong>
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
               <AlertDialogCancel className="cursor-pointer">{t('SettingsDialog.dangerZone.resetDialog.cancel')}</AlertDialogCancel>
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



// ################################
// ###   MAIN SETTINGS DIALOG   ###
// ################################

interface SettingsDialogProps {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
   onStartTour: () => void;
}



export function SettingsDialog({ isOpen, onOpenChange, onStartTour }: SettingsDialogProps) {
   const { t, i18n } = useTranslation();
   const locale = i18n.language?.split('-')[0] || 'en';

   const { resolvedTheme, setTheme: setMode } = useTheme();
   const { isMobile } = useDeviceType();

   const { theme: colorTheme, customThemes, isSideBySideView, isTrackersAlwaysEditable, isMobileFABMode } = useAppSettingsStore();
   const { setTheme: setColorTheme, setSideBySideView, setTrackersAlwaysEditable, setMobileFABMode } = useAppSettingsActions();
   const { setThemesOpen } = useAppGeneralStateActions();

   // The quick selector: presets + customs (so any theme is one click away without opening the manager).
   const themeOptions = [
      ...Object.entries(PRESET_LABELS).map(([value, label]) => ({ value, label })),
      ...customThemes.map((custom) => ({ value: customThemeClass(custom.id), label: custom.name })),
   ];

   const [isResetAppDialogOpen, setIsResetAppDialogOpen] = useState(false);
   const [isDeleteDrawerDialogOpen, setIsDeleteDrawerDialogOpen] = useState(false);
   const [isMigrationDialogOpen, setIsMigrationDialogOpen] = useState(false);
   const [isLegacyBackupDialogOpen, setIsLegacyBackupDialogOpen] = useState(false);
   const [isLegacyCharacterBackupDialogOpen, setIsLegacyCharacterBackupDialogOpen] = useState(false);
   const { removable: legacyBlobRemovable, refresh: refreshLegacyBlobRemovable } = useLegacyBlobRemovable(getLegacyBlobRemovalState);
   const { removable: legacyCharacterRemovable, refresh: refreshLegacyCharacterRemovable } = useLegacyBlobRemovable(getCharacterLegacyBlobRemovalState);

   const handleAppReset = async () => {
      await clearAllCharacterData();
      await clearAllAssets();
      await clearAllBoards();
      clearWorkspace();
      await clearAllDrawerData();
      drawerCommandEngine.clear();
      useAppSettingsStore.persist.clearStorage();
      setTimeout(() => window.location.reload(), 500);
      toast.success(t('Notifications.general.appReset'));
   };

   const handleDeleteDrawer = async () => {
      await clearAllDrawerData();
      drawerCommandEngine.clear();
      setTimeout(() => window.location.reload(), 500);
      toast.success(t('Notifications.drawer.deleted'));
   }

   // ==================
   //  Storage usage + reclaim (asset GC)
   // ==================
   // `null` means the estimate API is unavailable; the readout shows "unavailable".
   const [storageUsageBytes, setStorageUsageBytes] = useState<number | null>(null);
   const [isReclaiming, setIsReclaiming] = useState(false);

   // Refresh the usage readout whenever the dialog opens.
   useEffect(() => {
      if (!isOpen) return;
      let active = true;
      void estimateStorageUsage().then((usage) => {
         if (active) setStorageUsageBytes(usage);
      });
      return () => { active = false; };
   }, [isOpen]);

   const formatMegabytes = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1);

   const handleReclaimImageSpace = async () => {
      setIsReclaiming(true);
      try {
         const { deleted, reclaimedBytes } = await runSweep('manual');
         setStorageUsageBytes(await estimateStorageUsage());
         if (deleted > 0) {
            toast.success(t('SettingsDialog.storage.reclaimed', { count: deleted, mb: formatMegabytes(reclaimedBytes) }));
         } else {
            toast(t('SettingsDialog.storage.nothing'));
         }
      } catch {
         toast.error(t('SettingsDialog.storage.failed'));
      } finally {
         setIsReclaiming(false);
      }
   };

   const handleLocaleChange = (newLocale: string) => {
      i18n.changeLanguage(newLocale);
   };

   
   
   return (
      <>
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>

               <DialogHeader>
                  <DialogTitle>{t('SettingsDialog.title')}</DialogTitle>
                  <DialogDescription>{t('SettingsDialog.description')}</DialogDescription>
               </DialogHeader>


               <div className="grid gap-6 py-4">
                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label htmlFor="language-select" className="text-left">
                        {t('SettingsDialog.language')}
                     </Label>
                     <Select value={locale} onValueChange={handleLocaleChange}>
                        <SelectTrigger id="language-select" className="col-span-2 cursor-pointer">
                           <SelectValue placeholder={t('SettingsDialog.selectLanguagePlaceholder')} />
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
                     <Label htmlFor="theme-select" className="text-left">{t('SettingsDialog.accentColor')}</Label>
                     <div className="col-span-2 flex items-center gap-2">
                        {/* Quick switch to any theme (presets + customs); the manager window holds the CRUD. */}
                        <Select value={colorTheme} onValueChange={(value) => setColorTheme(value as typeof colorTheme)}>
                           <SelectTrigger id="theme-select" className="flex-1 min-w-0 cursor-pointer">
                              <SelectValue placeholder={t('SettingsDialog.selectThemePlaceholder')} />
                           </SelectTrigger>
                           <SelectContent>
                              {themeOptions.map((option) => (
                                 <SelectItem key={option.value} value={option.value} className="cursor-pointer">
                                    {option.label}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={() => setThemesOpen(true)} title={t('SettingsDialog.themes.manage')} className="shrink-0 cursor-pointer">
                           <Palette className="h-4 w-4 shrink-0" />
                           <span className="sr-only">{t('SettingsDialog.themes.manage')}</span>
                        </Button>
                     </div>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label className="text-left">{t('SettingsDialog.appearance')}</Label>
                     <div className="col-span-2 flex items-center gap-2">
                        <Button
                           variant={resolvedTheme === 'light' ? 'default' : 'outline'}
                           onClick={() => setMode('light')}
                           title={t('SettingsDialog.light')}
                           className="flex-1 min-w-0 cursor-pointer"
                        >
                           <Sun className="mr-2 h-4 w-4 shrink-0" />
                           <span className="truncate">{t('SettingsDialog.light')}</span>
                        </Button>
                        <Button
                           variant={resolvedTheme === 'dark' ? 'default' : 'outline'}
                           onClick={() => setMode('dark')}
                           title={t('SettingsDialog.dark')}
                           className="flex-1 min-w-0 cursor-pointer"
                        >
                           <Moon className="mr-2 h-4 w-4 shrink-0" />
                           <span className="truncate">{t('SettingsDialog.dark')}</span>
                        </Button>
                     </div>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label className="text-left">{t('SettingsDialog.cardView.title')}</Label>
                     <div className="col-span-2 flex items-center space-x-2">
                        <Button
                           variant={!isSideBySideView ? 'default' : 'outline'}
                           onClick={() => setSideBySideView(false)}
                           title={t('SettingsDialog.cardView.flipping')}
                           className="flex-1 min-w-0 cursor-pointer"
                        >
                           <FlipHorizontal className="mr-2 h-4 w-4 shrink-0" />
                           <span className="truncate">{t('SettingsDialog.cardView.flipping')}</span>
                        </Button>
                        <Button
                           variant={isSideBySideView ? 'default' : 'outline'}
                           onClick={() => setSideBySideView(true)}
                           title={t('SettingsDialog.cardView.sideBySide')}
                           className="flex-1 min-w-0 cursor-pointer"
                        >
                           <BookOpen className="mr-2 h-4 w-4 shrink-0" />
                           <span className="truncate">{t('SettingsDialog.cardView.sideBySide')}</span>
                        </Button>
                     </div>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label className="text-left">{t('SettingsDialog.trackerEdit.title')}</Label>
                     <div className="col-span-2 flex items-center space-x-2">
                        <Button
                           variant={!isTrackersAlwaysEditable ? 'default' : 'outline'}
                           onClick={() => setTrackersAlwaysEditable(false)}
                           title={t('SettingsDialog.trackerEdit.unlocked')}
                           className="flex-1 min-w-0 cursor-pointer"
                        >
                           <UnlockIcon className="mr-2 h-4 w-4 shrink-0" />
                           <span className="truncate">{t('SettingsDialog.trackerEdit.unlocked')}</span>
                        </Button>
                        <Button
                           variant={isTrackersAlwaysEditable ? 'default' : 'outline'}
                           onClick={() => setTrackersAlwaysEditable(true)}
                           title={t('SettingsDialog.trackerEdit.locked')}
                           className="flex-1 min-w-0 cursor-pointer"
                        >
                           <Lock className="mr-2 h-4 w-4 shrink-0" />
                           <span className="truncate">{t('SettingsDialog.trackerEdit.locked')}</span>
                        </Button>
                     </div>
                  </div>

                  {/* Mobile FAB Mode Setting - Only visible on mobile */}
                  {isMobile && (
                     <div className="grid grid-cols-3 items-center gap-4">
                        <Label className="text-left">{t('SettingsDialog.mobileFABMode.title')}</Label>
                        <div className="col-span-2 flex items-center space-x-2">
                           <Button
                              variant={!isMobileFABMode ? 'default' : 'outline'}
                              onClick={() => setMobileFABMode(false)}
                              title={t('SettingsDialog.mobileFABMode.bottomTabs')}
                              className="flex-1 min-w-0 cursor-pointer"
                           >
                              <Navigation className="mr-2 h-4 w-4 shrink-0" />
                              <span className="truncate">{t('SettingsDialog.mobileFABMode.bottomTabs')}</span>
                           </Button>
                           <Button
                              variant={isMobileFABMode ? 'default' : 'outline'}
                              onClick={() => setMobileFABMode(true)}
                              title={t('SettingsDialog.mobileFABMode.fab')}
                              className="flex-1 min-w-0 cursor-pointer"
                           >
                              <Menu className="mr-2 h-4 w-4 shrink-0" />
                              <span className="truncate">{t('SettingsDialog.mobileFABMode.fab')}</span>
                           </Button>
                        </div>
                     </div>
                  )}

                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label className="text-left">{t('SettingsDialog.migration.label')}</Label>
                     <Button onClick={() => setIsMigrationDialogOpen(true)} title={t('SettingsDialog.migration.button')} className="col-span-2 cursor-pointer min-w-0">
                        <DatabaseBackup className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{t('SettingsDialog.migration.button')}</span>
                     </Button>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label className="text-left">{t('SettingsDialog.tutorial')}</Label>
                     <Button onClick={onStartTour} title={t('SettingsDialog.tutorialButton')} className="col-span-2 cursor-pointer min-w-0">
                        <PlayCircle className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{t('SettingsDialog.tutorialButton')}</span>
                     </Button>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                     <Label className="text-left">{t('SettingsDialog.storage.label')}</Label>
                     <div className="col-span-2 flex items-center gap-2">
                        <span className="flex-1 min-w-0 truncate text-sm text-muted-foreground">
                           {storageUsageBytes === null
                              ? t('SettingsDialog.storage.usageUnavailable')
                              : t('SettingsDialog.storage.usageUsed', { mb: formatMegabytes(storageUsageBytes) })}
                        </span>
                        <Button
                           variant="outline"
                           onClick={handleReclaimImageSpace}
                           disabled={isReclaiming}
                           title={t('SettingsDialog.storage.reclaimButton')}
                           className="cursor-pointer min-w-0"
                        >
                           <HardDrive className="mr-2 h-4 w-4 shrink-0" />
                           <span className="truncate">{t('SettingsDialog.storage.reclaimButton')}</span>
                        </Button>
                     </div>
                  </div>
               </div>

               <Separator />

               <div className="space-y-4 rounded-lg border-2 border-destructive bg-destructive/5 p-4">
                  <div className="flex items-center gap-4">
                     <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
                     <div>
                        <h3 className="font-semibold">{t('SettingsDialog.dangerZone.title')}</h3>
                        <p className="text-sm text-muted-foreground">{t('SettingsDialog.dangerZone.description')}</p>
                     </div>
                  </div>

                  <div className="flex gap-2">
                     <Button
                        variant="destructive"
                        className="cursor-pointer flex-1 min-w-0"
                        onClick={() => setIsDeleteDrawerDialogOpen(true)}
                        title={t('SettingsDialog.dangerZone.deleteDrawerButton')}
                     >
                        <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{t('SettingsDialog.dangerZone.deleteDrawerButton')}</span>
                     </Button>
                     <Button
                        variant="destructive"
                        className="cursor-pointer flex-1 min-w-0"
                        onClick={() => setIsResetAppDialogOpen(true)}
                        title={t('SettingsDialog.dangerZone.resetButton')}
                     >
                        <OctagonMinus className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{t('SettingsDialog.dangerZone.resetButton')}</span>
                     </Button>
                  </div>

                  {/* Legacy backup cleanup - only shown once the migration is
                      verified faithful and the blob is still present. Removing it
                      is gated on a backup export + explicit confirm in the dialog. */}
                  {legacyBlobRemovable && (
                     <Button
                        variant="outline"
                        className="cursor-pointer w-full min-w-0"
                        onClick={() => setIsLegacyBackupDialogOpen(true)}
                        title={t('SettingsDialog.legacyBackup.actionLabel')}
                     >
                        <span className="truncate">{t('SettingsDialog.legacyBackup.actionLabel')}</span>
                     </Button>
                  )}

                  {legacyCharacterRemovable && (
                     <Button
                        variant="outline"
                        className="cursor-pointer w-full min-w-0"
                        onClick={() => setIsLegacyCharacterBackupDialogOpen(true)}
                        title={t('SettingsDialog.legacyCharacterBackup.actionLabel')}
                     >
                        <span className="truncate">{t('SettingsDialog.legacyCharacterBackup.actionLabel')}</span>
                     </Button>
                  )}
               </div>


            </DialogContent>
         </Dialog>

         <MigrationDialog
            isOpen={isMigrationDialogOpen}
            onOpenChange={setIsMigrationDialogOpen}
         />

         <LegacyDrawerBackupDialog
            isOpen={isLegacyBackupDialogOpen}
            onOpenChange={setIsLegacyBackupDialogOpen}
            onRemoved={refreshLegacyBlobRemovable}
         />

         <LegacyCharacterBackupDialog
            isOpen={isLegacyCharacterBackupDialogOpen}
            onOpenChange={setIsLegacyCharacterBackupDialogOpen}
            onRemoved={refreshLegacyCharacterRemovable}
         />

         <ConfirmationDialog
            open={isDeleteDrawerDialogOpen}
            onOpenChange={setIsDeleteDrawerDialogOpen}
            onConfirm={handleDeleteDrawer}
            title={t('SettingsDialog.dangerZone.deleteDrawerDialog.title')}
            description={t('SettingsDialog.dangerZone.deleteDrawerDialog.description')}
            confirmationText="DELETE DRAWER"
            confirmButtonText={t('SettingsDialog.dangerZone.deleteDrawerDialog.confirm')}
         />

         <ConfirmationDialog
            open={isResetAppDialogOpen}
            onOpenChange={setIsResetAppDialogOpen}
            onConfirm={handleAppReset}
            title={t('SettingsDialog.dangerZone.resetDialog.title')}
            description={t('SettingsDialog.dangerZone.resetDialog.description')}
            confirmationText="DELETE ALL MY APP DATA"
            confirmButtonText={t('SettingsDialog.dangerZone.resetDialog.confirm')}
         />
      </>
   );
}