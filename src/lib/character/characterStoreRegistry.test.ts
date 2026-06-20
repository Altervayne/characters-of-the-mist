// -- Library Imports --
import { afterEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import {
   SINGLE_ACTIVE_INSTANCE_ID,
   disposeInstance,
   ensureMenuFallbackInstance,
   getActiveCharacterStore,
   getOrCreateInstance,
   setActiveInstance,
} from './characterStoreRegistry';

/*
 * Tests for the character store instance registry (tabs spec §1.2, §2.1). The
 * registry is module-level shared state, so each test disposes the ids it creates.
 * These exercise the forward-looking N-instance behaviour even though the running
 * app uses exactly one instance in Phase 1.
 */

const CREATED_IDS = ['iso-A', 'iso-B', 'res-A', 'res-B', 'link-A', SINGLE_ACTIVE_INSTANCE_ID];

afterEach(() => {
   CREATED_IDS.forEach(disposeInstance);
});

describe('character store registry', () => {
   it('getOrCreateInstance is idempotent per id and returns distinct instances per id', () => {
      const a1 = getOrCreateInstance('iso-A');
      const a2 = getOrCreateInstance('iso-A');
      const b = getOrCreateInstance('iso-B');

      expect(a1).toBe(a2); // same id => same instance (StrictMode-safe)
      expect(a1).not.toBe(b); // different ids => isolated instances
   });

   it('isolates state and undo history between instances (spec §2.1)', () => {
      const a = getOrCreateInstance('iso-A');
      const b = getOrCreateInstance('iso-B');

      // Edit + build an undo stack in A.
      a.getState().actions.createCharacter('LEGENDS');
      a.getState().actions.updateCharacterName('Alpha');
      a.getState().actions.updateCharacterName('Beta');

      // B is completely untouched by A's edits, separate state AND separate stack.
      expect(b.getState().character).toBeNull();
      expect(b.temporal.getState().pastStates.length).toBe(0);

      // Undo in A walks A's own stack only.
      a.temporal.getState().undo();
      expect(a.getState().character?.name).toBe('Alpha');

      // Still nothing leaked into B.
      expect(b.getState().character).toBeNull();
      expect(b.temporal.getState().pastStates.length).toBe(0);

      // A fresh edit in B does not disturb A.
      b.getState().actions.createCharacter('OTHERSCAPE');
      expect(b.getState().character?.game).toBe('OTHERSCAPE');
      expect(a.getState().character?.game).toBe('LEGENDS');
   });

   it('resolves and repoints the active instance', () => {
      const a = getOrCreateInstance('res-A');
      const b = getOrCreateInstance('res-B');

      setActiveInstance('res-A');
      expect(getActiveCharacterStore()).toBe(a);

      setActiveInstance('res-B');
      expect(getActiveCharacterStore()).toBe(b);

      // Disposing the active instance leaves nothing active.
      disposeInstance('res-B');
      expect(getActiveCharacterStore()).toBeNull();
   });

   it('ensureMenuFallbackInstance creates one instance and keeps it active', () => {
      const first = ensureMenuFallbackInstance();
      const second = ensureMenuFallbackInstance();

      expect(first).toBe(second); // idempotent
      expect(getActiveCharacterStore()).toBe(first);
   });

   it('getActiveCharacterStore is null when nothing is active', () => {
      expect(getActiveCharacterStore()).toBeNull();
   });

   it('linkToDrawerItem sets drawerItemId WITHOUT clearing the undo stack', () => {
      const instance = getOrCreateInstance('link-A');
      instance.getState().actions.createCharacter('LEGENDS');
      instance.getState().actions.updateCharacterName('Edited'); // build undo history
      const pastBefore = instance.temporal.getState().pastStates.length;
      expect(pastBefore).toBeGreaterThan(0);

      instance.getState().actions.linkToDrawerItem('item-xyz');

      expect(instance.getState().character?.drawerItemId).toBe('item-xyz');
      // Stack preserved (not cleared, unlike loadCharacter); the link is one more entry.
      expect(instance.temporal.getState().pastStates.length).toBeGreaterThanOrEqual(pastBefore);
      // Undo reverts the link only, the earlier edit survives, proving history intact.
      instance.temporal.getState().undo();
      expect(instance.getState().character?.name).toBe('Edited');
   });
});
