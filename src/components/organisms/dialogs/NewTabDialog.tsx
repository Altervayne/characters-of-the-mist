// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// -- Icon Imports --
import { ScrollText, Building2, Bot } from 'lucide-react';

// -- Store Imports --
import { useTabManagerActions } from '@/lib/character/tabManagerStore';

// -- Type Imports --
import type { GameSystem } from '@/lib/types/drawer';

/*
 * The New Tab dialog (tabs spec §5.1). Framed as a tab-TYPE chooser even though only
 * "Character Sheet" exists today, so Boards/Notes become additional entries here
 * later with no change to the tab lifecycle. Choosing Character Sheet picks a game,
 * which calls `createCharacterTab(game)` (reusing the MainMenu game labels).
 */

/** The selectable games, reusing the MainMenu translation keys and iconography. */
const GAME_OPTIONS: { game: GameSystem; labelKey: string; icon: typeof ScrollText; accent: string }[] = [
   { game: 'LEGENDS', labelKey: 'MainMenu.games.legends.title', icon: ScrollText, accent: 'text-amber-500' },
   { game: 'CITY_OF_MIST', labelKey: 'MainMenu.games.cityOfMist.title', icon: Building2, accent: 'text-purple-500' },
   { game: 'OTHERSCAPE', labelKey: 'MainMenu.games.otherscape.title', icon: Bot, accent: 'text-cyan-500' },
];

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
         <DialogContent>
            <DialogHeader>
               <DialogTitle>{t('Tabs.newTabDialog.title')}</DialogTitle>
               <DialogDescription>{t('Tabs.newTabDialog.description')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
               {/* Tab type: only Character Sheet today; future types become sibling sections. */}
               <h3 className="text-sm font-semibold text-muted-foreground">{t('Tabs.newTabDialog.characterSheetType')}</h3>
               <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {GAME_OPTIONS.map(({ game, labelKey, icon: Icon, accent }) => (
                     <Button
                        key={game}
                        variant="outline"
                        onClick={() => handlePickGame(game)}
                        className="h-auto flex-col gap-2 py-4 cursor-pointer"
                     >
                        <Icon className={`h-6 w-6 shrink-0 ${accent}`} />
                        <span className="text-center text-sm whitespace-normal">{t(labelKey)}</span>
                     </Button>
                  ))}
               </div>
            </div>
         </DialogContent>
      </Dialog>
   );
}
