// -- Other Library Imports --
import cuid from 'cuid';

// -- Factory Imports --
import { buildCard } from '@/lib/cards/buildCard';
import { emptyCharacterCardDetails } from '@/lib/utils/character';
import { EMBEDDED_CARD_SIZE, EMBEDDED_POSTIT_SIZE, embeddedSpecForComponent } from '@/lib/board/embedDrawerItem';
import { DEFAULT_CONNECTION_STYLE } from '@/lib/board/boardConnections';
import { DEFAULT_BOARD_GRID } from '@/lib/board/boardRecords';

// -- Local Imports --
import { DEMO_BOARD_ID } from './demoSentinels';

// -- Type Imports --
import type { Board, BoardItem, CardBoardContent, Stroke } from '@/lib/types/board';
import type { Card } from '@/lib/types/character';

/*
 * The demo board the Board + Portals tutorials teach against (D3, D5). A valid `Board` aggregate
 * authored to the current board model, seeding exactly what the D3 arc leans on: two game cards joined
 * by a connection (the "read a link" beat), one shape drawing carrying a single stroke (the draw gate's
 * baseline to beat, plus a drawing row for the Layers panel), a post-it for flavour, and a framing zone
 * for the group node. Every tile is self-contained (no drawer/note/asset reference), so nothing reaches a
 * real store; the cards are built through the real embed factory so their copy shape can never drift from
 * a hand-written literal. The items cluster to one side, leaving the initial view center clear so a
 * center-drop lands as its own thing. The assembled template is deep-frozen and a fresh `structuredClone`
 * is handed out per run, so a demo gesture mutates only the clone and the next run starts clean.
 */

const DEMO_BOARD_NAME = 'The Sunken Vault';

/** Recursively freezes an object graph so the shared template cannot be mutated in place. */
function deepFreeze<T>(value: T): T {
   if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value as Record<string, unknown>).forEach(deepFreeze);
      Object.freeze(value);
   }
   return value;
}

/** The board-copy content for a sheet card, via the real embed factory (so the copy shape stays honest). */
function cardContent(card: Card | null): CardBoardContent {
   if (!card) throw new Error('demo board card factory returned null');
   const spec = embeddedSpecForComponent(card);
   // embeddedSpecForComponent always returns a card spec for a real card type; the guard keeps the types honest.
   if (!spec || spec.content.kind !== 'card') throw new Error('demo board card embed spec was not a card');
   return spec.content;
}

function buildDemoBoard(): Board {
   const zoneId = cuid();
   const heroId = cuid();
   const themeId = cuid();
   const postItId = cuid();
   const drawingId = cuid();
   const connectionId = cuid();

   // The hero card is built directly (its factory takes no tag counts, unlike the theme options).
   const hero: Card = { id: cuid(), cardType: 'CHARACTER_CARD', title: 'Hero Card', isFlipped: false, details: emptyCharacterCardDetails('LEGENDS', 'Aria Duskbound') };
   const heroCard = cardContent(hero);
   const themeCard = cardContent(buildCard('LEGENDS', {
      cardType: 'CHARACTER_THEME',
      themebook: 'The Drowned Court',
      themeType: 'Adventure',
      mainTagName: 'Keeper of the tide-locked door',
      powerTagsCount: 2,
      weaknessTagsCount: 1,
   }, DEMO_BOARD_NAME));

   // A single geometric stroke (an ellipse from two bbox corners, in layer-local coords) - the fixture's
   // one shape, so the draw-stroke gate has a baseline of 1 to beat and the Layers panel has a drawing row.
   const shapeStroke: Stroke = { id: cuid(), brush: 'pen', color: null, width: 3, points: [0, 0, 160, 120], shape: 'ellipse', filled: false };

   const items: BoardItem[] = [
      // A framing zone the tour can teach grouping / collapse against; renders behind its members.
      { id: zoneId, kind: 'zone', x: 0, y: 0, width: 640, height: 700, z: 0, content: { kind: 'zone', label: 'The Vault', collapsed: false } },
      // Two embedded cards (frozen copies), joined below by a connection: the hero and the scene.
      { id: heroId, kind: 'card', x: 40, y: 60, width: EMBEDDED_CARD_SIZE.width, height: EMBEDDED_CARD_SIZE.height, z: 1, content: heroCard },
      { id: themeId, kind: 'card', x: 330, y: 60, width: EMBEDDED_CARD_SIZE.width, height: EMBEDDED_CARD_SIZE.height, z: 2, content: themeCard },
      // A sticky note off to the side: the board's simplest self-contained tile.
      { id: postItId, kind: 'post-it', x: 720, y: 60, width: EMBEDDED_POSTIT_SIZE.width, height: EMBEDDED_POSTIT_SIZE.height, z: 3, content: { kind: 'post-it', mode: 'copy', data: { id: cuid(), text: 'The vault door only opens at low tide.' } } },
      // A one-stroke shape drawing: a drawing layer the Layers panel lists and the draw gate baselines on.
      { id: drawingId, kind: 'drawing', x: 720, y: 320, width: 160, height: 120, z: 4, content: { kind: 'drawing', strokes: [shapeStroke], seq: 1 } },
      // A connection wiring the two cards, so the tour can teach reading + restyling a link.
      { id: connectionId, kind: 'connection', x: 0, y: 0, width: 0, height: 0, z: 5, content: { kind: 'connection', from: heroId, to: themeId, style: { ...DEFAULT_CONNECTION_STYLE } } },
   ];

   return {
      id: DEMO_BOARD_ID,
      name: DEMO_BOARD_NAME,
      viewport: { x: 0, y: 0, zoom: 1 },
      drawerItemId: null,
      grid: { ...DEFAULT_BOARD_GRID },
      // Above the one drawing's seq (1), so a freshly drawn layer never reuses its ordinal.
      nextLayerSeq: 2,
      items,
   };
}

/** The frozen template, built once. Never handed out directly - clone it. */
const DEMO_BOARD_TEMPLATE = deepFreeze(buildDemoBoard());

/** A fresh, mutable demo board for one tutorial run (a deep clone of the frozen template). */
export function createDemoBoard(): Board {
   return structuredClone(DEMO_BOARD_TEMPLATE);
}
