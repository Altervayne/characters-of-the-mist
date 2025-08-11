'use client';

// -- React Imports --
import React, { useState } from 'react';

// -- Next Imports --
import { useTranslations } from 'next-intl';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';



interface LegacyDataDialogProps {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
}

const LEGACY_STORAGE_KEY = 'characterData';
const CONFIRMATION_PHRASE = 'DISMISS OLD DATA';



export function LegacyDataDialog({ isOpen, onOpenChange }: LegacyDataDialogProps) {
   const t = useTranslations('LegacyDataDialog');
   const tNotifications = useTranslations('Notifications');
   const [confirmationText, setConfirmationText] = useState('');

   const handleDownload = () => {
      const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyData) return;

      const blob = new Blob([legacyData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'legacy-character-data.json';
      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(tNotifications('migration.legacyDataDownloaded'));
   };

   const handleDismiss = () => {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      onOpenChange(false);
   };



   return (
      <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
         <AlertDialogContent className="border-3 border-primary border-dashed z-[10000]">
            <AlertDialogHeader>
               <AlertDialogTitle>{t('title')}</AlertDialogTitle>
               <AlertDialogDescription>{t('info')}</AlertDialogDescription>
               <AlertDialogDescription>{t('description')}</AlertDialogDescription>
               <AlertDialogDescription>{t('warning')}</AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2 py-2">
               <Label htmlFor="dismiss-confirmation">{t('confirmationLabel')}</Label>
               <p className="w-full text-center text-sm font-bold text-destructive">{CONFIRMATION_PHRASE}</p>
               <Input
                  id="dismiss-confirmation"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder={CONFIRMATION_PHRASE}
                  autoComplete="off"
               />
            </div>

            <AlertDialogFooter>
               <Button variant="destructive" onClick={handleDismiss} className="cursor-pointer" disabled={confirmationText !== CONFIRMATION_PHRASE}>
                  {t('dismissButton')}
               </Button>
               <Button onClick={handleDownload} className="cursor-pointer">
                  {t('downloadButton')}
               </Button>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   );
};