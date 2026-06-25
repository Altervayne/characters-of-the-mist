import { describe, expect, it } from 'vitest';

import { condensedThemeRow, condensedThemeRows, trackerCounts } from './characterOverview';
import type { Card, Character } from '@/lib/types/character';

/*
 * The condensed theme-row derivation across games/types: a CHARACTER_THEME carries type + themebook,
 * a GROUP_THEME (fellowship/crew) carries neither, a LOADOUT_THEME carries gear/flaws + wildcards.
 */

const tag = (name: string, over: Partial<{ isActive: boolean; isScratched: boolean }> = {}) => ({ id: name, name, isActive: false, isScratched: false, ...over });

function card(over: Partial<Card> & Pick<Card, 'cardType' | 'details'>): Card {
   return { id: 'c', title: '', order: 0, isFlipped: false, ...over } as Card;
}

describe('condensedThemeRow', () => {
   it('reads a Legends CHARACTER_THEME: type + themebook + main tag + counts', () => {
      const row = condensedThemeRow(card({
         id: 'theme-1',
         cardType: 'CHARACTER_THEME',
         details: { game: 'LEGENDS', themeType: 'Origin', themebook: 'The Last Blade', mainTag: tag("The Sword's Whisper"), powerTags: [tag('a'), tag('b'), tag('c')], weaknessTags: [tag('w')] } as unknown as Card['details'],
      }));
      expect(row).toMatchObject({ id: 'theme-1', rowKind: 'theme', themeType: 'Origin', themebook: 'The Last Blade', mainTagName: "The Sword's Whisper", powerCount: 3, weaknessCount: 1, wildcardSlots: null });
   });

   it('reads a GROUP_THEME with no themebook/type (fellowship/crew)', () => {
      const row = condensedThemeRow(card({ cardType: 'GROUP_THEME', details: { game: 'LEGENDS', mainTag: tag('The Bond'), powerTags: [tag('a')], weaknessTags: [] } as unknown as Card['details'] }));
      expect(row).toMatchObject({ rowKind: 'group', themeType: null, themebook: null, mainTagName: 'The Bond', powerCount: 1, weaknessCount: 0, wildcardSlots: null });
   });

   it('reads an Otherscape LOADOUT_THEME: gear/flaws counts + wildcard slots, no type', () => {
      const row = condensedThemeRow(card({ cardType: 'LOADOUT_THEME', details: { game: 'OTHERSCAPE', mainTag: tag(''), powerTags: [tag('g1'), tag('g2')], weaknessTags: [tag('f1')], wildcardSlots: 2 } as unknown as Card['details'] }));
      expect(row).toMatchObject({ rowKind: 'loadout', themeType: null, themebook: null, mainTagName: null, powerCount: 2, weaknessCount: 1, wildcardSlots: 2 });
   });

   it('surfaces a scratched/active main tag and a null name when blank', () => {
      const row = condensedThemeRow(card({ cardType: 'CHARACTER_THEME', details: { game: 'CITY_OF_MIST', themeType: 'Mythos', themebook: '', mainTag: tag('  ', { isScratched: true, isActive: true }), powerTags: [], weaknessTags: [] } as unknown as Card['details'] }));
      expect(row).toMatchObject({ themebook: null, mainTagName: null, mainTagScratched: true, mainTagActive: true });
   });
});

describe('condensedThemeRows / trackerCounts', () => {
   it('includes only theme cards (skips the character + image cards), in order', () => {
      const character = {
         cards: [
            card({ cardType: 'CHARACTER_CARD', details: {} as Card['details'] }),
            card({ id: 't1', cardType: 'CHARACTER_THEME', details: { game: 'LEGENDS', themeType: 'Origin', themebook: 'A', mainTag: tag('m'), powerTags: [], weaknessTags: [] } as unknown as Card['details'] }),
            card({ cardType: 'IMAGE_CARD', details: { game: 'NEUTRAL', assetId: null } as unknown as Card['details'] }),
            card({ id: 't2', cardType: 'GROUP_THEME', details: { game: 'LEGENDS', mainTag: tag('g'), powerTags: [], weaknessTags: [] } as unknown as Card['details'] }),
         ],
      } as Character;
      expect(condensedThemeRows(character).map((r) => r.id)).toEqual(['t1', 't2']);
   });

   it('counts trackers across the three lists', () => {
      const character = { trackers: { statuses: [{}, {}], storyTags: [{}], storyThemes: [] } } as unknown as Character;
      expect(trackerCounts(character)).toEqual({ statuses: 2, tags: 1, themes: 0, total: 3 });
   });
});
