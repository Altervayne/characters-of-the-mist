// -- React Imports --
import type { NamedExoticComponent, RefAttributes } from 'react';

// -- Component Imports --
import { LegendsThemeCard } from '@/components/organisms/cards/LegendsThemeCard';
import { CityThemeCard } from '@/components/organisms/cards/CityThemeCard';
import { OtherscapeThemeCard } from '@/components/organisms/cards/OtherscapeThemeCard';
import { HeroCard } from '@/components/organisms/cards/HeroCard';
import { RiftCard } from '@/components/organisms/cards/RiftCard';
import { OtherscapeCharacterCard } from '@/components/organisms/cards/OtherscapeCharacterCard';

// -- Type Imports --
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { Card as CardData } from '@/lib/types/character';
import type { GameSystem, GeneralItemType } from '@/lib/types/drawer';



/**
 * The common prop surface shared by every card organism. Both interactive sheet
 * cards (CardRenderer) and static drawer-preview snapshots (DrawerItemPreview)
 * pass a subset of these.
 */
export interface CardComponentProps {
   card: CardData;
   isEditing?: boolean;
   isSnapshot?: boolean;
   isDrawerPreview?: boolean;
   dragAttributes?: DraggableAttributes;
   dragListeners?: SyntheticListenerMap;
   onEditCard?: () => void;
   onExport?: () => void;
}

export type CardComponent = NamedExoticComponent<CardComponentProps & RefAttributes<HTMLDivElement>>;

/**
 * Resolves a card's type and game to its concrete card organism component.
 *
 * Shared by CardRenderer (interactive sheet cards) and DrawerItemPreview
 * (`isDrawerPreview` snapshots) so the type-and-game-to-component mapping lives in
 * one place; each caller renders the returned component with its own props.
 * Returns null when the combination has no renderer, leaving the caller to render
 * its own fallback.
 *
 * Note: LOADOUT_THEME resolves only for Otherscape - loadout themes exist only in
 * that game. This matches DrawerItemPreview's original behaviour exactly.
 * CardRenderer previously grouped LOADOUT_THEME with the other theme types for all
 * games, but a Legends/City loadout theme is unreachable, so no real card is
 * affected by the unified mapping.
 */
export function resolveCardComponent(cardType: GeneralItemType, game: GameSystem): CardComponent | null {
   if (cardType === 'CHARACTER_THEME' || cardType === 'GROUP_THEME') {
      if (game === 'LEGENDS') return LegendsThemeCard;
      if (game === 'CITY_OF_MIST') return CityThemeCard;
      if (game === 'OTHERSCAPE') return OtherscapeThemeCard;
   }
   if (cardType === 'LOADOUT_THEME') {
      if (game === 'OTHERSCAPE') return OtherscapeThemeCard;
   }
   if (cardType === 'CHARACTER_CARD') {
      if (game === 'LEGENDS') return HeroCard;
      if (game === 'CITY_OF_MIST') return RiftCard;
      if (game === 'OTHERSCAPE') return OtherscapeCharacterCard;
   }
   return null;
}
