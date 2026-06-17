// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { LegacyBackupDialog } from '@/components/organisms/dialogs/LegacyBackupDialog';

// -- Character Data Layer Imports --
import { getLegacyCharacterForBackup, removeLegacyCharacterBlob } from '@/lib/character/runCharacterMigration';
import { exportCharacterSheet } from '@/lib/utils/export-import';



interface LegacyCharacterBackupDialogProps {
   isOpen: boolean;
   onOpenChange: (open: boolean) => void;
   /** Called after the legacy blob has been removed (so the opener can hide the action). */
   onRemoved: () => void;
}

/**
 * Character-domain wrapper around {@link LegacyBackupDialog}: supplies the active
 * character's safety-backup exporter (`exportCharacterSheet`), blob remover, and
 * i18n. Mirrors {@link import('./LegacyDrawerBackupDialog').LegacyDrawerBackupDialog}.
 */
export function LegacyCharacterBackupDialog({ isOpen, onOpenChange, onRemoved }: LegacyCharacterBackupDialogProps) {
   const { t } = useTranslation();

   const downloadBackup = (): boolean => {
      const character = getLegacyCharacterForBackup();
      if (!character) return false;
      try {
         exportCharacterSheet(character);
         return true;
      } catch {
         return false;
      }
   };

   return (
      <LegacyBackupDialog
         isOpen={isOpen}
         onOpenChange={onOpenChange}
         onRemoved={onRemoved}
         downloadBackup={downloadBackup}
         removeBlob={removeLegacyCharacterBlob}
         title={t('SettingsDialog.legacyCharacterBackup.confirmTitle')}
         description={t('SettingsDialog.legacyCharacterBackup.confirmDescription')}
         downloadButtonLabel={t('SettingsDialog.legacyCharacterBackup.downloadBackupButton')}
         backupDownloadedLabel={t('SettingsDialog.legacyCharacterBackup.backupDownloadedLabel')}
         confirmCheckboxLabel={t('SettingsDialog.legacyCharacterBackup.confirmCheckbox')}
         removeButtonLabel={t('SettingsDialog.legacyCharacterBackup.removeButton')}
         cancelLabel={t('SettingsDialog.legacyCharacterBackup.cancel')}
         exportFailedMessage={t('Notifications.character.legacyBackupExportFailed')}
         downloadedMessage={t('Notifications.character.legacyBackupDownloaded')}
         removedMessage={t('Notifications.character.legacyBackupRemoved')}
         removeFailedMessage={t('Notifications.drawer.actionFailed')}
      />
   );
}
