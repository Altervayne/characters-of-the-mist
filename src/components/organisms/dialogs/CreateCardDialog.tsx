// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// -- Component Imports --
import { CardCreationForm } from '@/components/organisms/cards/CardCreationForm';

// -- Store Imports --
import { useTutorialStore } from '@/lib/tutorial/tutorialStore';

// -- Type Imports --
import type { Card as CardData } from '@/lib/types/character';
import type { CreateCardOptions } from '@/lib/types/creation';
import type { GameSystem } from '@/lib/types/drawer';

/*
 * The sheet's card-creation dialog: the shared {@link CardCreationForm} in a center modal. The form
 * is also used board-side in an anchored popover; this shell stays the sheet's familiar UX.
 */

interface CreateCardDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (options: CreateCardOptions, cardId?: string) => void;
  mode: 'create' | 'edit';
  cardData?: CardData;
  modal?: boolean;
  game: GameSystem;
  /** Board-only: also offer the game's character card (Hero/Merc/Rift). A sheet keeps its one-per-sheet rule. */
  allowCharacterCard?: boolean;
}

export function CreateCardDialog({ isOpen, onOpenChange, onConfirm, mode, cardData, modal = true, game, allowCharacterCard = false }: CreateCardDialogProps) {
   const { t } = useTranslation();
   // During a tutorial the coach-mark lives outside this modal, so a click on it reads as an outside dismiss;
   // ignore outside-close + Esc while a run is active so the create-card step can't be stranded.
   const isTutorialActive = useTutorialStore((state) => state.activeTutorialId !== null);

   return (
      <Dialog open={isOpen} onOpenChange={onOpenChange} modal={modal}>
         <DialogContent
            data-tutorial="creation-dialog"
            onInteractOutside={(event) => { if (isTutorialActive) event.preventDefault(); }}
            onEscapeKeyDown={(event) => { if (isTutorialActive) event.preventDefault(); }}
         >
            <DialogHeader>
               <DialogTitle>{mode === 'create' ? t('CreateCardDialog.title') : t('CreateCardDialog.editTitle')}</DialogTitle>
               <DialogDescription>{mode === 'create' ? t('CreateCardDialog.description') : t('CreateCardDialog.editDescription')}</DialogDescription>
            </DialogHeader>

            <CardCreationForm
               game={game}
               mode={mode}
               cardData={cardData}
               allowCharacterCard={allowCharacterCard}
               onConfirm={(options, cardId) => { onConfirm(options, cardId); onOpenChange(false); }}
            />
         </DialogContent>
      </Dialog>
   );
}
