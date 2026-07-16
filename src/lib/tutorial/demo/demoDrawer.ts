// -- Factory Imports --
import { emptyTracker } from '@/lib/trackers/emptyTracker';

// -- Drawer Data Layer Imports --
import { DRAWER_ROOT_PARENT_ID } from '@/lib/drawer/drawerRecords';

// -- Local Imports --
import { createDemoCharacter } from './demoCharacter';
import { createDemoBoard } from './demoBoard';
import { createDemoNote } from './demoNote';
import {
   DEMO_DRAWER_FOLDER_CREW_ID,
   DEMO_DRAWER_FOLDER_HANDOUTS_ID,
   DEMO_DRAWER_ITEM_BOARD_ID,
   DEMO_DRAWER_ITEM_CHARACTER_ID,
   DEMO_DRAWER_ITEM_NOTE_ID,
   DEMO_DRAWER_ITEM_TRACKER_ID,
} from './demoSentinels';

// -- Type Imports --
import type { DrawerFolderRecord, DrawerItemRecord } from '@/lib/drawer/drawerRecords';
import type { StatusTracker } from '@/lib/types/character';

/*
 * The demo drawer the Drawer tutorial (D6) teaches against. A brand-new user's real drawer is empty, which
 * would gut the folders / items / preview / search beats, so the tour reads a small curated library instead:
 * two folders plus four varied items (a saved board, a status tracker, a saved character, a saved note),
 * with staggered created / edited dates so the date line, date-range search, and previews all have content.
 *
 * The item CONTENTS reuse the existing D3 / D2 / D4 fixtures (board, character, note) so their aggregate shapes
 * can never drift from a hand-written literal; every one is self-contained and asset-free, so nothing reaches a
 * real store. This is the FIXTURE only - flat folder + item records exactly as the drawer repository returns
 * them; the in-memory backend serves reads from it. The assembled template is deep-frozen and a fresh
 * `structuredClone` is handed out per run, so a demo run mutates only the clone and the next run starts clean.
 */

/** A flat drawer fixture: folder and item records, as the repository's read functions return them. */
export interface DemoDrawerFixture {
   folders: DrawerFolderRecord[];
   items: DrawerItemRecord[];
}

// Fixed, staggered timestamps (epoch ms) so the fixture is deterministic and its date line / range search
// always have something to show. Anchored to a plain date; the offsets fan the four items across a week.
const DAY = 86_400_000;
const BASE = Date.UTC(2026, 5, 1, 12, 0, 0);

/** Recursively freezes an object graph so the shared template cannot be mutated in place. */
function deepFreeze<T>(value: T): T {
   if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value as Record<string, unknown>).forEach(deepFreeze);
      Object.freeze(value);
   }
   return value;
}

/** A status tracker for the tracker item, so the library shows a non-sheet, non-board kind too. */
function buildDemoTracker(): StatusTracker {
   return { ...emptyTracker('STATUS'), name: 'Rising Tide', tiers: [true, true, true, false, false, false] };
}

function buildDemoDrawer(): DemoDrawerFixture {
   const folders: DrawerFolderRecord[] = [
      { id: DEMO_DRAWER_FOLDER_CREW_ID, name: 'The Vault Crew', parentFolderId: DRAWER_ROOT_PARENT_ID, order: 0 },
      { id: DEMO_DRAWER_FOLDER_HANDOUTS_ID, name: 'Handouts', parentFolderId: DRAWER_ROOT_PARENT_ID, order: 1 },
   ];

   const items: DrawerItemRecord[] = [
      // Two items at root, so the items beat has cards to spotlight the moment the drawer opens.
      {
         id: DEMO_DRAWER_ITEM_BOARD_ID,
         name: 'The Sunken Vault',
         parentFolderId: DRAWER_ROOT_PARENT_ID,
         order: 0,
         game: 'LEGENDS',
         type: 'FULL_BOARD',
         createdAt: BASE + DAY,
         updatedAt: BASE + 5 * DAY,
         content: createDemoBoard(),
      },
      {
         id: DEMO_DRAWER_ITEM_TRACKER_ID,
         name: 'Rising Tide',
         parentFolderId: DRAWER_ROOT_PARENT_ID,
         order: 1,
         game: 'NEUTRAL',
         type: 'STATUS_TRACKER',
         createdAt: BASE + 4 * DAY,
         updatedAt: BASE + 4 * DAY,
         content: buildDemoTracker(),
      },
      // The character lives in "The Vault Crew", the note in "Handouts", so each folder carries a summary count.
      {
         id: DEMO_DRAWER_ITEM_CHARACTER_ID,
         name: 'Aria Duskbound',
         parentFolderId: DEMO_DRAWER_FOLDER_CREW_ID,
         order: 0,
         game: 'LEGENDS',
         type: 'FULL_CHARACTER_SHEET',
         createdAt: BASE,
         updatedAt: BASE + 2 * DAY,
         content: createDemoCharacter(),
      },
      {
         id: DEMO_DRAWER_ITEM_NOTE_ID,
         name: "The Warden's Briefing",
         parentFolderId: DEMO_DRAWER_FOLDER_HANDOUTS_ID,
         order: 0,
         game: 'NEUTRAL',
         type: 'NOTE',
         createdAt: BASE + 3 * DAY,
         updatedAt: BASE + 6 * DAY,
         content: createDemoNote(),
      },
   ];

   return { folders, items };
}

/** The frozen template, built once. Never handed out directly - clone it. */
const DEMO_DRAWER_TEMPLATE = deepFreeze(buildDemoDrawer());

/** A fresh, mutable demo drawer fixture for one tutorial run (a deep clone of the frozen template). */
export function createDemoDrawer(): DemoDrawerFixture {
   return structuredClone(DEMO_DRAWER_TEMPLATE);
}
