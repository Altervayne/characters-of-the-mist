// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Store Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';
import { getActiveCharacterStore } from '@/lib/character/characterStoreRegistry';
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

// -- Type Imports --
import type { Card as CardData } from '@/lib/types/character';
import type { CreateCardOptions } from '@/lib/types/creation';



/**
 * Manages the create/edit card dialog's state and handlers.
 *
 * Tracks whether the dialog is open, whether it is in 'create' or 'edit' mode,
 * and which card is being edited. `handleEditCard` opens the dialog in edit mode
 * for a given card, `handleAddCardClick` opens it in create mode, and
 * `handleDialogConfirm` dispatches to the appropriate store action - updating the
 * card's themebook/type in edit mode, or adding a new card in create mode - each
 * with a success toast.
 *
 * @returns The dialog open state and setter, the current mode and card-to-edit,
 *   and the open/confirm handlers wired to the dialog and the card list.
 */
export function useCardDialogState() {
   const { t: tNotifications } = useTranslation();
   const { addCard, updateCardDetails, addChallengeCard } = useCharacterActions();
   const isCardDialogOpen = useAppGeneralStateStore((state) => state.isCardDialogOpen);
   const { setCardDialogOpen } = useAppGeneralStateActions();
   const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
   const [cardToEdit, setCardToEdit] = useState<CardData | null>(null);
   // Challenge cards are too rich for the generic dialog: they route to their own editor.
   const [challengeCardToEdit, setChallengeCardToEdit] = useState<CardData | null>(null);

   const handleEditCard = (card: CardData) => {
      if (card.cardType === 'CHALLENGE_CARD') {
         setChallengeCardToEdit(card);
         return;
      }
      setDialogMode('edit');
      setCardToEdit(card);
      setCardDialogOpen(true);
   };

   const closeChallengeEditor = () => setChallengeCardToEdit(null);

   // Create a blank challenge and drop straight into its editor.
   const handleCreateChallenge = () => {
      const id = addChallengeCard();
      const newCard = getActiveCharacterStore()?.getState().character?.cards.find((card) => card.id === id) ?? null;
      if (newCard) setChallengeCardToEdit(newCard);
   };

   const handleAddCardClick = () => {
      setDialogMode('create');
      setCardToEdit(null);
      setCardDialogOpen(true);
   };

   const handleDialogConfirm = (options: CreateCardOptions, cardId?: string) => {
      if (dialogMode === 'edit' && cardId) {
         updateCardDetails(cardId, { themebook: options.themebook, themeType: options.themeType });
         toast.success(tNotifications('Notifications.card.updated'));
      } else {
         addCard(options);
         toast.success(tNotifications('Notifications.card.created'));
      }
   };

   return {
      isCardDialogOpen,
      setCardDialogOpen,
      dialogMode,
      cardToEdit,
      challengeCardToEdit,
      closeChallengeEditor,
      handleCreateChallenge,
      handleEditCard,
      handleAddCardClick,
      handleDialogConfirm,
   };
}
