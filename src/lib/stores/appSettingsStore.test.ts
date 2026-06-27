// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { useAppSettingsStore } from './appSettingsStore';

// -- Type Imports --
import type { DiceTrayContent } from '@/lib/dice/diceTrayTypes';

/*
 * Tests for the app-wide dice-tray settings slice: the default (empty, closed), the open/toggle actions,
 * and that content edits land (the persist middleware saves them; here we assert the in-memory state, the
 * single source the panel reads).
 */

describe('appSettingsStore diceTray slice', () => {
   beforeEach(() => {
      useAppSettingsStore.setState({ diceTray: { content: { dice: [], modifiers: [] }, isOpen: false } });
   });

   it('defaults to an empty tray, closed', () => {
      const { diceTray } = useAppSettingsStore.getState();
      expect(diceTray.isOpen).toBe(false);
      expect(diceTray.content).toEqual({ dice: [], modifiers: [] });
   });

   it('toggleDiceTray flips isOpen, leaving content untouched', () => {
      const { actions } = useAppSettingsStore.getState();
      actions.setDiceTrayContent({ dice: [{ id: 'a', sides: 20 }], modifiers: [] });
      actions.toggleDiceTray();
      expect(useAppSettingsStore.getState().diceTray.isOpen).toBe(true);
      expect(useAppSettingsStore.getState().diceTray.content.dice).toEqual([{ id: 'a', sides: 20 }]);
      actions.toggleDiceTray();
      expect(useAppSettingsStore.getState().diceTray.isOpen).toBe(false);
   });

   it('setDiceTrayOpen sets the panel state directly', () => {
      const { actions } = useAppSettingsStore.getState();
      actions.setDiceTrayOpen(true);
      expect(useAppSettingsStore.getState().diceTray.isOpen).toBe(true);
      actions.setDiceTrayOpen(false);
      expect(useAppSettingsStore.getState().diceTray.isOpen).toBe(false);
   });

   it('setDiceTrayContent replaces content (config edits and rolls both land here, no undo)', () => {
      const { actions } = useAppSettingsStore.getState();
      const rolled: DiceTrayContent = {
         dice: [{ id: 'a', sides: 20 }],
         modifiers: [{ id: 'm', label: 'Bonus', value: 2 }],
         lastRoll: { faces: { a: 17 }, modifiers: [{ label: 'Bonus', value: 2 }], total: 19 },
      };
      actions.setDiceTrayContent(rolled);
      expect(useAppSettingsStore.getState().diceTray.content).toEqual(rolled);
      expect(useAppSettingsStore.getState().diceTray.isOpen).toBe(false); // content edit doesn't open the panel
   });
});
