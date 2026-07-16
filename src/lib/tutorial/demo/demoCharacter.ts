// -- Other Library Imports --
import cuid from 'cuid';

// -- Factory Imports --
import { emptyCharacterCardDetails } from '@/lib/utils/character';
import { buildCard } from '@/lib/cards/buildCard';
import { emptyTracker } from '@/lib/trackers/emptyTracker';
import { DEFAULT_IMAGE_CARD_SIZE } from '@/lib/constants/imageCard';

// -- Local Imports --
import { DEMO_CHARACTER_ID, DEMO_PORTRAIT_ASSET_ID } from './demoSentinels';

// -- Type Imports --
import type { Card, Character, ImageCardDetails, LegendsHeroDetails, LegendsThemeDetails, StatusTracker, StoryTagTracker } from '@/lib/types/character';

/*
 * The demo character the tutorials teach against (D1 Navigation, D2 Sheet). A plain, valid
 * LEGENDS `Character` authored to the current 2.0 model: a complete `sheetLayout`, `journals: []`,
 * cards + trackers built through the real factories so their unions can never drift from a hand-
 * written literal. The portrait rides a bundled placeholder via a reserved asset sentinel, never
 * the asset store. The assembled template is deep-frozen and a fresh `structuredClone` is handed
 * out per run, so a demo-sheet edit mutates only the clone and the next run starts clean.
 */

const DEMO_NAME = 'Aria Duskbound';

/** Recursively freezes an object graph so the shared template cannot be mutated in place. */
function deepFreeze<T>(value: T): T {
   if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value as Record<string, unknown>).forEach(deepFreeze);
      Object.freeze(value);
   }
   return value;
}

/** The Hero card: the game's character card, enriched with sample content so the sheet reads populated. */
function buildHeroCard(): Card {
   // The factory returns the game-union; a single narrowing cast keeps it the shape source of record.
   const base = emptyCharacterCardDetails('LEGENDS', DEMO_NAME) as LegendsHeroDetails;
   const details: LegendsHeroDetails = {
      ...base,
      promise: 2,
      quintessences: [{ id: cuid(), name: 'Unbreakable resolve' }],
      backpack: [{ id: cuid(), name: 'Oathbound blade', isActive: false, isScratched: false }],
   };
   return { id: cuid(), cardType: 'CHARACTER_CARD', title: 'Hero Card', isFlipped: false, details };
}

/** A LEGENDS theme card with named tags, so the cards beat has something concrete to spotlight. */
function buildThemeCard(): Card {
   const card = buildCard(
      'LEGENDS',
      {
         cardType: 'CHARACTER_THEME',
         themebook: 'The Wandering Blade',
         themeType: 'Adventure',
         mainTagName: 'Duelist without a home',
         powerTagsCount: 3,
         weaknessTagsCount: 1,
      },
      DEMO_NAME,
   );
   // buildCard always returns a card for LEGENDS/CHARACTER_THEME; the guard keeps the types honest.
   if (!card) throw new Error('demo theme card factory returned null');
   const details = card.details as LegendsThemeDetails;
   const powerNames = ['Riposte', 'Read the room', 'Blade dance'];
   const weaknessNames = ['Haunted by a broken vow'];
   details.powerTags = details.powerTags.map((tag, index) => ({ ...tag, name: powerNames[index] ?? tag.name }));
   details.weaknessTags = details.weaknessTags.map((tag, index) => ({ ...tag, name: weaknessNames[index] ?? tag.name }));
   return card;
}

/** The portrait: an empty-frame IMAGE_CARD pointed at the bundled placeholder sentinel (no asset store). */
function buildPortraitCard(): Card {
   const details: ImageCardDetails = {
      game: 'NEUTRAL',
      assetId: DEMO_PORTRAIT_ASSET_ID,
      fit: 'cover',
      width: DEFAULT_IMAGE_CARD_SIZE.width,
      height: DEFAULT_IMAGE_CARD_SIZE.height,
   };
   return { id: cuid(), cardType: 'IMAGE_CARD', title: 'Portrait', isFlipped: false, details };
}

function buildDemoCharacter(): Character {
   const portrait = buildPortraitCard();
   const hero = buildHeroCard();
   const theme = buildThemeCard();

   const wounded: StatusTracker = { ...emptyTracker('STATUS'), name: 'Wounded-2', tiers: [true, true, false, false, false, false] };
   const clue: StoryTagTracker = { ...emptyTracker('STORY_TAG'), name: 'On the trail' };

   return {
      id: DEMO_CHARACTER_ID,
      name: DEMO_NAME,
      game: 'LEGENDS',
      cards: [portrait, hero, theme],
      journals: [],
      sheetLayout: [
         { kind: 'card', id: portrait.id },
         { kind: 'card', id: hero.id },
         { kind: 'card', id: theme.id },
      ],
      trackers: {
         statuses: [wounded],
         storyTags: [clue],
         storyThemes: [],
      },
   };
}

/** The frozen template, built once. Never handed out directly - clone it. */
const DEMO_CHARACTER_TEMPLATE = deepFreeze(buildDemoCharacter());

/** A fresh, mutable demo character for one tutorial run (a deep clone of the frozen template). */
export function createDemoCharacter(): Character {
   return structuredClone(DEMO_CHARACTER_TEMPLATE);
}
