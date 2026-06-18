// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
 * The New Tab dialog (tabs spec §5.1). Framed as a tab-TYPE chooser even though only
 * "Character Sheet" exists today, so Boards/Notes become additional sections later
 * with no change to the tab lifecycle. Choosing a game calls `createCharacterTab(game)`
 * and closes the dialog. The game cards reuse the shared {@link GameCard} so the
 * dialog matches the MainMenu picker exactly.
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
   const { createCharacterTab } = useTabManagerActions();

   const handlePickGame = (game: GameSystem) => {
      createCharacterTab(game);
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
               {/* Tab type: only Character Sheet today; future types become sibling sections. */}
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
            </div>
         </DialogContent>
      </Dialog>
   );
}
