// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

// -- Icon Imports --
import { Check, Download } from 'lucide-react';

// -- Drawer Data Layer Imports --
import { getLegacyDrawerForBackup, removeLegacyDrawerBlob } from '@/lib/drawer/runDrawerMigration';
import { exportDrawer } from '@/lib/utils/export-import';



interface LegacyDrawerBackupDialogProps {
   isOpen: boolean;
   onOpenChange: (open: boolean) => void;
   /** Called after the legacy blob has been removed (so the opener can hide the action). */
   onRemoved: () => void;
}

/**
 * User-data-safe retirement of the legacy drawer backup blob.
 *
 * Explains the one-time migration, then gates removal behind BOTH a completed
 * backup export (required, not merely offered) AND an explicit acknowledgement
 * checkbox; the "Remove" button stays disabled until both are satisfied. The
 * caller is responsible for only mounting this when removal is allowed
 * (`useLegacyBlobRemovable`), which itself requires the migration-time
 * `migrationVerified` flag. Nothing is deleted on cancel, on an export failure, or
 * before the gates pass.
 */
export function LegacyDrawerBackupDialog({ isOpen, onOpenChange, onRemoved }: LegacyDrawerBackupDialogProps) {
   const { t } = useTranslation();
   const [backupDownloaded, setBackupDownloaded] = useState(false);
   const [acknowledged, setAcknowledged] = useState(false);

   // Reset the gates whenever the dialog closes, so a prior session's state can
   // never carry over into a new removal (done in the close handler rather than an
   // effect to avoid a synchronous setState-in-effect).
   const handleOpenChange = (open: boolean) => {
      if (!open) {
         setBackupDownloaded(false);
         setAcknowledged(false);
      }
      onOpenChange(open);
   };

   const handleDownloadBackup = () => {
      const drawer = getLegacyDrawerForBackup();
      if (!drawer) {
         toast.error(t('Notifications.drawer.legacyBackupExportFailed'));
         return;
      }
      try {
         exportDrawer(drawer);
         setBackupDownloaded(true);
         toast.success(t('Notifications.drawer.legacyBackupDownloaded'));
      } catch {
         toast.error(t('Notifications.drawer.legacyBackupExportFailed'));
      }
   };

   const canRemove = backupDownloaded && acknowledged;

   const handleRemove = async () => {
      if (!canRemove) return; // defensive: never remove without backup + explicit confirm
      try {
         await removeLegacyDrawerBlob();
         toast.success(t('Notifications.drawer.legacyBackupRemoved'));
         onRemoved();
         handleOpenChange(false);
      } catch {
         toast.error(t('Notifications.drawer.actionFailed'));
      }
   };

   return (
      <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
         <AlertDialogContent>
            <AlertDialogHeader>
               <AlertDialogTitle>{t('SettingsDialog.legacyBackup.confirmTitle')}</AlertDialogTitle>
               <AlertDialogDescription>{t('SettingsDialog.legacyBackup.confirmDescription')}</AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-3 py-2">
               <Button variant="outline" onClick={handleDownloadBackup} className="w-full cursor-pointer">
                  {backupDownloaded ? <Check className="mr-2 h-4 w-4 text-primary" /> : <Download className="mr-2 h-4 w-4" />}
                  {backupDownloaded
                     ? t('SettingsDialog.legacyBackup.backupDownloadedLabel')
                     : t('SettingsDialog.legacyBackup.downloadBackupButton')}
               </Button>

               <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox
                     checked={acknowledged}
                     onCheckedChange={(value) => setAcknowledged(value === true)}
                     disabled={!backupDownloaded}
                     className="mt-0.5"
                  />
                  <span>{t('SettingsDialog.legacyBackup.confirmCheckbox')}</span>
               </label>
            </div>

            <AlertDialogFooter>
               <AlertDialogCancel className="cursor-pointer">{t('SettingsDialog.legacyBackup.cancel')}</AlertDialogCancel>
               <AlertDialogAction
                  onClick={handleRemove}
                  disabled={!canRemove}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
               >
                  {t('SettingsDialog.legacyBackup.removeButton')}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   );
}
