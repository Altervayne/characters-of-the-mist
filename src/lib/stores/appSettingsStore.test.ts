// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { useAppSettingsStore } from './appSettingsStore';

// -- Type Imports --
import type { DiceTrayContent } from '@/lib/dice/diceTrayTypes';
import type { CustomTheme } from '@/lib/theme/themeTokens';
import { PRESET_THEMES } from '@/lib/theme/themeTokens';

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

describe('appSettingsStore customThemes slice', () => {
   const makeTheme = (id: string): CustomTheme => ({
      id, name: `Theme ${id}`, radius: '0.5rem',
      light: PRESET_THEMES['theme-neutral'].light, dark: PRESET_THEMES['theme-neutral'].dark,
   });

   beforeEach(() => {
      useAppSettingsStore.setState({ theme: 'theme-neutral', customThemes: [] });
   });

   it('addCustomTheme appends and updateCustomTheme patches by id', () => {
      const { actions } = useAppSettingsStore.getState();
      actions.addCustomTheme(makeTheme('a'));
      actions.addCustomTheme(makeTheme('b'));
      actions.updateCustomTheme('a', { name: 'Renamed' });
      const list = useAppSettingsStore.getState().customThemes;
      expect(list.map((t) => t.id)).toEqual(['a', 'b']);
      expect(list.find((t) => t.id === 'a')?.name).toBe('Renamed');
   });

   it('deleteCustomTheme resets the active theme to a preset when the deleted theme was active', () => {
      const { actions } = useAppSettingsStore.getState();
      actions.addCustomTheme(makeTheme('a'));
      actions.setTheme('theme-custom-a');
      actions.deleteCustomTheme('a');
      expect(useAppSettingsStore.getState().customThemes).toEqual([]);
      expect(useAppSettingsStore.getState().theme).toBe('theme-neutral');
   });

   it('deleteCustomTheme leaves the active theme alone when a different theme was active', () => {
      const { actions } = useAppSettingsStore.getState();
      actions.addCustomTheme(makeTheme('a'));
      actions.addCustomTheme(makeTheme('b'));
      actions.setTheme('theme-custom-b');
      actions.deleteCustomTheme('a');
      expect(useAppSettingsStore.getState().theme).toBe('theme-custom-b');
   });
});
