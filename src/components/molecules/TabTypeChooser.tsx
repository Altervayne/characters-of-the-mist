// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { LayoutGrid } from 'lucide-react';

// -- Component Imports --
import { GameCard } from '@/components/molecules/GameCard';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Store Imports --
import { useTabManagerActions } from '@/lib/character/tabManagerStore';

// -- Constants --
import { GAME_VISUALS, GAME_CARD_OPTIONS, BOARD_VISUAL } from '@/lib/constants/gameVisuals';

// -- Type Imports --
import type { GameSystem } from '@/lib/types/drawer';

/*
 * The shared tab-TYPE chooser: a Character Sheet section (one card per game) and a Board section (one
 * full-width card). One click creates AND activates that tab - no select step, no separate commit.
 * Used by both the landing MainMenu and the New Tab dialog, so the two surfaces never drift.
 */

interface TabTypeChooserProps {
   /** Fired after any choice (the dialog closes on it; the MainMenu passes nothing). */
   onChoose?: () => void;
}

export function TabTypeChooser({ onChoose }: TabTypeChooserProps) {
   const { t } = useTranslation();
   const { createCharacterTab, createBoardTab } = useTabManagerActions();

   const pickGame = (game: GameSystem) => {
      createCharacterTab(game);
      onChoose?.();
   };

   const pickBoard = () => {
      // The board row materializes asynchronously; the chooser can dismiss at once.
      void createBoardTab();
      onChoose?.();
   };

   return (
      <div className="flex w-full flex-col gap-4">
         {/* Character sheet: one card per game, one click creates that game's sheet. */}
         <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground">{t('Tabs.newTabDialog.characterSheetType')}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
               {GAME_CARD_OPTIONS.map(({ game, titleKey, subtitleKey }) => {
                  const { Icon, accentText, gradient } = GAME_VISUALS[game];
                  return (
                     <GameCard
                        key={game}
                        isSelected={false}
                        onClick={() => pickGame(game)}
                        title={t(titleKey)}
                        subtitle={t(subtitleKey)}
                        gradient={gradient}
                        icon={<Icon className={cn('h-6 w-6', accentText)} />}
                     />
                  );
               })}
            </div>
         </section>

         {/* Board: one full-width card, spanning the row to read as the distinct second type. */}
         <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground">{t('Tabs.newTabDialog.boardType')}</h3>
            <GameCard
               isSelected={false}
               onClick={pickBoard}
               title={t('Tabs.newTabDialog.newBoardTitle')}
               subtitle={t('Tabs.newTabDialog.newBoardSubtitle')}
               gradient={BOARD_VISUAL.gradient}
               icon={<LayoutGrid className={cn('h-6 w-6', BOARD_VISUAL.accentText)} />}
            />
         </section>
      </div>
   );
}
