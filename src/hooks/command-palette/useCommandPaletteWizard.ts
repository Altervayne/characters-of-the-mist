// -- React Imports --
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Type Imports --
import type { CreateCardOptions } from '@/lib/types/creation';

/**
 * Manages the transient state accumulated by the command palette's creation
 * wizards (create-card and create-tracker), plus the input placeholder.
 *
 * Owns the shared text input value, the in-progress card options, the chosen
 * tracker type, and the randomised/contextual placeholder shown in the input.
 * Wizard input state (the input value and card options) is cleared whenever the
 * palette closes, matching the palette's reset-on-close behaviour. The tracker
 * type and placeholder are intentionally left untouched on close, preserving
 * the existing behaviour.
 *
 * @param isOpen - Whether the command palette is currently open.
 * @param activePage - The id of the currently active palette page; drives the
 *   contextual placeholder shown in the input.
 * @returns The wizard state values, their setters, the current placeholder, and
 *   the ref to attach to the palette's text input.
 */
export function useCommandPaletteWizard(isOpen: boolean, activePage: string) {
   const { t } = useTranslation();

   const [inputValue, setInputValue] = useState('');
   const [cardOptions, setCardOptions] = useState<Partial<CreateCardOptions>>({});
   const [trackerType, setTrackerType] = useState<'STATUS' | 'STORY_TAG' | null>(null);
   const [placeholder, setPlaceholder] = useState(t('CommandPalette.placeholder_1'));

   const inputRef = useRef<HTMLInputElement>(null);

   // Reset the wizard input state whenever the palette closes.
   useEffect(() => {
      if (!isOpen) {
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setInputValue('');
         setCardOptions({});
      }
   }, [isOpen]);

   // Choose the input placeholder based on the active page; the root and other
   // pages fall back to a randomly selected flavour placeholder.
   useEffect(() => {
      if (isOpen) {
         let newPlaceholder = '';
         const randomIndex = Math.floor(Math.random() * 25) + 1;

         switch (activePage) {
            case 'renameCharacter': newPlaceholder = t('CommandPalette.placeholders.renameCharacter'); break;

            case 'rollDice': newPlaceholder = t('CommandPalette.placeholders.rollDice'); break;

            case 'createCard_ThemeType': newPlaceholder = t('CommandPalette.placeholders.themeType'); break;
            case 'createCard_Themebook': newPlaceholder = t('CommandPalette.placeholders.themebook'); break;
            case 'createCard_MainTag': newPlaceholder = t('CommandPalette.placeholders.mainTagName'); break;
            case 'createCard_PowerTags': newPlaceholder = t('CommandPalette.placeholders.powerTags'); break;
            case 'createCard_WeaknessTags': newPlaceholder = t('CommandPalette.placeholders.weaknessTags'); break;

            case 'createTracker_Type': newPlaceholder = t('CommandPalette.placeholders.trackerType'); break;
            case 'createTracker_Name': newPlaceholder = t('CommandPalette.placeholders.trackerName'); break;

            default:
               newPlaceholder = t(`CommandPalette.placeholder_${randomIndex}`);
         }

         // Update placeholder based on active page
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setPlaceholder(newPlaceholder);
         inputRef.current?.focus();
      }
   }, [isOpen, t, activePage]);

   return {
      inputValue,
      setInputValue,
      cardOptions,
      setCardOptions,
      trackerType,
      setTrackerType,
      placeholder,
      inputRef,
   };
}
