// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { CREATION_TAXONOMY } from './creationTaxonomy';
import { CREATABLE_REGISTRY } from './creatableRegistry';

// -- Type Imports --
import type { CreatableKind } from './creatableRegistry';

/*
 * The taxonomy is the single catalog the Add popover + the radial both read, so it must stay total
 * against the registry: every board-native kind lands in exactly one board group (Basic / Rich),
 * with no orphan and no duplicate. These guard against a new kind being added to the registry but
 * forgotten in the taxonomy (it would silently vanish from both creation surfaces).
 */

const boardKinds = CREATION_TAXONOMY.flatMap((group) => (group.key === 'game' ? [] : group.kinds));

describe('creation taxonomy', () => {
   it('presents the three groups in order', () => {
      expect(CREATION_TAXONOMY.map((group) => group.key)).toEqual(['basic', 'rich', 'game']);
   });

   it('places every registry kind in exactly one board group', () => {
      const registryKinds = CREATABLE_REGISTRY.map((entry) => entry.kind).sort();
      expect([...boardKinds].sort()).toEqual(registryKinds);
   });

   it('never lists a kind twice', () => {
      expect(new Set(boardKinds).size).toBe(boardKinds.length);
   });

   it('carries the three Game rows with their handler identities', () => {
      const game = CREATION_TAXONOMY.find((group) => group.key === 'game');
      expect(game?.key).toBe('game');
      if (game?.key !== 'game') return;
      expect(game.rows.map((row) => row.kind)).toEqual(['trackers', 'cards', 'challenge']);
   });

   it('keeps the portal a picker-first basic element', () => {
      const basic = CREATION_TAXONOMY.find((group) => group.key === 'basic');
      expect(basic?.key).toBe('basic');
      if (basic?.key !== 'basic') return;
      const portal = CREATABLE_REGISTRY.find((entry) => entry.kind === ('portal' satisfies CreatableKind));
      expect(basic.kinds).toContain('portal');
      expect(portal?.requiresPicker).toBe(true);
   });
});
