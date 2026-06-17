// -- React Imports --
import { useState } from 'react';

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



export interface LegacyBackupDialogProps {
   isOpen: boolean;
   onOpenChange: (open: boolean) => void;
   /** Called after the legacy blob has been removed (so the opener can hide the action). */
   onRemoved: () => void;
   /** Performs the safety-backup export. Returns `true` on success, `false` on failure (never throws). */
   downloadBackup: () => boolean;
   /** Removes the legacy blob (already gated by the caller + this dialog's checkbox/backup). */
   removeBlob: () => Promise<void>;
   // Pre-translated labels (the domain wrapper supplies these).
   title: string;
   description: string;
   downloadButtonLabel: string;
   backupDownloadedLabel: string;
   confirmCheckboxLabel: string;
   removeButtonLabel: string;
   cancelLabel: string;
   // Pre-translated toast messages.
   exportFailedMessage: string;
   downloadedMessage: string;
   removedMessage: string;
   removeFailedMessage: string;
}

/**
 * Domain-agnostic, user-data-safe retirement of a legacy backup blob.
 *
 * Explains the one-time migration, then gates removal behind BOTH a completed
 * backup export (required, not merely offered) AND an explicit acknowledgement
 * checkbox; the "Remove" button stays disabled until both are satisfied. The caller
 * is responsible for only mounting this when removal is allowed (which itself
 * requires the migration-time verification flag). Nothing is deleted on cancel, on
 * an export failure, or before the gates pass. Domain wrappers (drawer, character)
 * inject the exporter, remover, labels, and toast messages.
 */
export function LegacyBackupDialog({
   isOpen,
   onOpenChange,
   onRemoved,
   downloadBackup,
   removeBlob,
   title,
   description,
   downloadButtonLabel,
   backupDownloadedLabel,
   confirmCheckboxLabel,
   removeButtonLabel,
   cancelLabel,
   exportFailedMessage,
   downloadedMessage,
   removedMessage,
   removeFailedMessage,
}: LegacyBackupDialogProps) {
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
      if (downloadBackup()) {
         setBackupDownloaded(true);
         toast.success(downloadedMessage);
      } else {
         toast.error(exportFailedMessage);
      }
   };

   const canRemove = backupDownloaded && acknowledged;

   const handleRemove = async () => {
      if (!canRemove) return; // defensive: never remove without backup + explicit confirm
      try {
         await removeBlob();
         toast.success(removedMessage);
         onRemoved();
         handleOpenChange(false);
      } catch {
         toast.error(removeFailedMessage);
      }
   };

   return (
      <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
         <AlertDialogContent>
            <AlertDialogHeader>
               <AlertDialogTitle>{title}</AlertDialogTitle>
               <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-3 py-2">
               <Button variant="outline" onClick={handleDownloadBackup} className="w-full cursor-pointer">
                  {backupDownloaded ? <Check className="mr-2 h-4 w-4 text-primary" /> : <Download className="mr-2 h-4 w-4" />}
                  {backupDownloaded ? backupDownloadedLabel : downloadButtonLabel}
               </Button>

               <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox
                     checked={acknowledged}
                     onCheckedChange={(value) => setAcknowledged(value === true)}
                     disabled={!backupDownloaded}
                     className="mt-0.5"
                  />
                  <span>{confirmCheckboxLabel}</span>
               </label>
            </div>

            <AlertDialogFooter>
               <AlertDialogCancel className="cursor-pointer">{cancelLabel}</AlertDialogCancel>
               <AlertDialogAction
                  onClick={handleRemove}
                  disabled={!canRemove}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
               >
                  {removeButtonLabel}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   );
}
