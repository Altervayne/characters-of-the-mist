// -- Icon Imports --
import { ScrollText } from 'lucide-react';

// -- Store Imports --
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';

// -- Type Imports --
import type { TutorialDefinition } from '../tutorialTypes';

/**
 * D2 - Character Sheet. Ported from the old desktop tour's sheet arc: overview, name, trackers,
 * cards, a gated Edit-mode toggle, adding a card, and back to play mode. The one gate advances on
 * the user's real toggle (isEditing flips true); every other beat is driven on Next. Edit-mode
 * drives read fresh through `runTutorialAction`, never captured setters. Step copy is ported from
 * the existing `Tutorial.*` keys.
 */
export const DESKTOP_SHEET_TUTORIAL: TutorialDefinition = {
   id: 'desktop.sheet',
   platform: 'desktop',
   system: 'sheet',
   titleKey: 'TutorialsDialog.tutorials.sheet.title',
   teachKey: 'TutorialsDialog.tutorials.sheet.teach',
   icon: ScrollText,
   // Teach against a seeded demo character (deterministic sample content), never the user's real sheet.
   needsDemo: 'character',
   steps: [
      {
         id: 'overview',
         anchorKey: 'character-sheet',
         titleKey: 'Tutorial.playArea_title',
         bodyKey: 'Tutorial.playArea_content',
         placement: 'top',
         advance: { on: 'next-click' },
      },
      {
         id: 'name',
         anchorKey: 'character-name-input',
         titleKey: 'Tutorial.characterName_title',
         bodyKey: 'Tutorial.characterName_content',
         placement: 'bottom',
         advance: { on: 'next-click' },
      },
      {
         id: 'trackers',
         anchorKey: 'trackers-section',
         titleKey: 'Tutorial.trackers_title',
         bodyKey: 'Tutorial.trackers_content',
         placement: 'bottom',
         advance: { on: 'next-click' },
      },
      {
         id: 'cards',
         anchorKey: 'cards-section',
         titleKey: 'Tutorial.cards_title',
         bodyKey: 'Tutorial.cards_content',
         placement: 'top',
         advance: { on: 'next-click' },
      },
      {
         // The one gate: start in play mode, advance only when the user toggles Edit on themselves.
         id: 'edit-mode',
         drive: { type: 'setEditing', value: false },
         anchorKey: 'edit-mode-toggle',
         titleKey: 'Tutorial.editMode_title',
         bodyKey: 'Tutorial.editMode_content',
         placement: 'right',
         interaction: 'anchor-only',
         advance: {
            on: 'user-action',
            signal: { kind: 'store', predicate: () => useAppGeneralStateStore.getState().isEditing },
         },
      },
      {
         // Edit mode is on from the gate, so the add-card control is present. Teardown returns to
         // play mode if the run is abandoned here.
         id: 'add-card',
         anchorKey: 'add-card-button',
         titleKey: 'Tutorial.addCard_title',
         bodyKey: 'Tutorial.addCard_content',
         placement: 'left',
         teardown: { type: 'setEditing', value: false },
         advance: { on: 'next-click' },
      },
      {
         id: 'play-mode',
         drive: { type: 'setEditing', value: false },
         anchorKey: 'edit-mode-toggle',
         titleKey: 'Tutorial.playMode_title',
         bodyKey: 'Tutorial.playMode_content',
         placement: 'right',
         advance: { on: 'next-click' },
      },
      {
         id: 'wrap',
         titleKey: 'Tutorial.closingWords_title',
         bodyKey: 'Tutorial.closingWords_content',
         placement: 'center',
         advance: { on: 'next-click' },
      },
   ],
};
