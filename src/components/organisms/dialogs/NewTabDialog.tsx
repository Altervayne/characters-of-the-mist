// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// -- Icon Imports --
import { LayoutGrid } from 'lucide-react';

// -- Component Imports --
import { GameCard } from '@/components/molecules/GameCard';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Store Imports --
import { useTabManagerActions } from '@/lib/character/tabManagerStore';

// -- Constants --
import { GAME_VISUALS, GAME_CARD_OPTIONS } from '@/lib/constants/gameVisuals';

// -- Type Imports --
import type { GameSystem } from '@/lib/types/drawer';

/*
 * The New Tab dialog: a tab-TYPE chooser. The Character Sheet section picks a game and
 * calls `createCharacterTab(game)`; the Board section creates a freeform board via
 * `createBoardTab()`. Either choice closes the dialog. The cards reuse the shared
 * {@link GameCard}.
 */

interface NewTabDialogProps {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
}

/**
 * Renders the New Tab dialog. On a game choice it creates and activates a new
 * character tab, then closes the dialog.
 *
 * @param props.isOpen - Whether the dialog is open.
 * @param props.onOpenChange - Open-state setter (closes on a choice or dismiss).
 */
export function NewTabDialog({ isOpen, onOpenChange }: NewTabDialogProps) {
   const { t } = useTranslation();
   const { createCharacterTab, createBoardTab } = useTabManagerActions();

   const handlePickGame = (game: GameSystem) => {
      createCharacterTab(game);
      onOpenChange(false);
   };

   const handleNewBoard = () => {
      // The board row is created asynchronously, but the dialog can close at once: the
      // tab + placeholder appear when `createBoardTab` resolves.
      void createBoardTab();
      onOpenChange(false);
   };

   return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
         <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
               <DialogTitle>{t('Tabs.newTabDialog.title')}</DialogTitle>
               <DialogDescription>{t('Tabs.newTabDialog.description')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
               {/* Tab type: a Character Sheet (pick a game) or a Board. */}
               <h3 className="text-sm font-semibold text-muted-foreground">{t('Tabs.newTabDialog.characterSheetType')}</h3>
               <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {GAME_CARD_OPTIONS.map(({ game, titleKey, subtitleKey }) => {
                     const { Icon, accentText, gradient } = GAME_VISUALS[game];
                     return (
                        <GameCard
                           key={game}
                           compact
                           isSelected={false}
                           onClick={() => handlePickGame(game)}
                           title={t(titleKey)}
                           subtitle={t(subtitleKey)}
                           gradient={gradient}
                           icon={<Icon className={cn('h-6 w-6', accentText)} />}
                        />
                     );
                  })}
               </div>

               <h3 className="text-sm font-semibold text-muted-foreground">{t('Tabs.newTabDialog.boardType')}</h3>
               <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <GameCard
                     compact
                     isSelected={false}
                     onClick={handleNewBoard}
                     title={t('Tabs.newTabDialog.newBoardTitle')}
                     subtitle={t('Tabs.newTabDialog.newBoardSubtitle')}
                     gradient="bg-gradient-to-br from-sky-500 to-indigo-600"
                     icon={<LayoutGrid className="h-6 w-6 text-sky-500" />}
                  />
               </div>
            </div>
         </DialogContent>
      </Dialog>
   );
}
