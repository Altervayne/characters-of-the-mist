import { useCharacterActions } from '@/lib/stores/characterStore';
import type { Card, CardViewMode } from '@/lib/types/character';

/**
 * Provides a handler to cycle a card's view mode through SIDE_BY_SIDE -> FLIP -> null (global default) -> SIDE_BY_SIDE.
 * Centralizes the cycling logic that was duplicated across all card components.
 */
export function useCardViewMode(card: Card): { handleCycleViewMode: () => void } {
   const actions = useCharacterActions();

   const handleCycleViewMode = () => {
      let nextMode: CardViewMode | null = null;
      if (card.viewMode === 'SIDE_BY_SIDE') {
         nextMode = 'FLIP';
      } else if (card.viewMode === 'FLIP') {
         nextMode = null;
      } else {
         nextMode = 'SIDE_BY_SIDE';
      }
      actions.updateCardViewMode(card.id, nextMode);
   };

   return { handleCycleViewMode };
}
