import { describe, expect, it } from 'vitest';

import { buildCard } from './buildCard';
import type { CreateCardOptions } from '@/lib/types/creation';

/*
 * The shared card factory: each game x type (incl. CHARACTER_CARD), fresh ids, and a generic title
 * when no character name is given (the board) vs the sheet's "<name>'s ..." title when one is.
 */

const themeOptions = (overrides: Partial<CreateCardOptions> = {}): CreateCardOptions => ({
   cardType: 'CHARACTER_THEME',
   themebook: 'Adept',
   themeType: 'Mythos',
   powerTagsCount: 2,
   weaknessTagsCount: 1,
   ...overrides,
});

describe('buildCard', () => {
   it('builds a Legends theme card with the requested tag counts and game-free generic title', () => {
      const card = buildCard('LEGENDS', themeOptions({ themeType: 'Origin' }))!;
      expect(card.cardType).toBe('CHARACTER_THEME');
      expect(card.details.game).toBe('LEGENDS');
      const details = card.details as { powerTags: unknown[]; weaknessTags: unknown[] };
      expect(details.powerTags).toHaveLength(2);
      expect(details.weaknessTags).toHaveLength(1);
      // No character name -> a plain title (the themebook), not "<name>'s ...".
      expect(card.title).toBe('Adept');
   });

   it('uses the sheet title when a character name is supplied', () => {
      const card = buildCard('LEGENDS', themeOptions({ themeType: 'Origin' }), 'Aria')!;
      expect(card.title).toBe("Aria's Theme Card - Adept/Origin");
   });

   it('builds City and Otherscape group/loadout themes', () => {
      expect(buildCard('CITY_OF_MIST', themeOptions({ cardType: 'GROUP_THEME' }))!.cardType).toBe('GROUP_THEME');
      const loadout = buildCard('OTHERSCAPE', themeOptions({ cardType: 'LOADOUT_THEME', wildcardSlots: 2 }))!;
      expect(loadout.cardType).toBe('LOADOUT_THEME');
      expect((loadout.details as { wildcardSlots: number }).wildcardSlots).toBe(2);
   });

   it('builds an EMPTY character card per game with the right title', () => {
      const hero = buildCard('LEGENDS', { cardType: 'CHARACTER_CARD', powerTagsCount: 0, weaknessTagsCount: 0 })!;
      expect(hero.cardType).toBe('CHARACTER_CARD');
      expect(hero.details.game).toBe('LEGENDS');
      expect(hero.title).toBe('Hero Card');
      expect((hero.details as { characterName: string }).characterName).toBe('');

      expect(buildCard('OTHERSCAPE', { cardType: 'CHARACTER_CARD', powerTagsCount: 0, weaknessTagsCount: 0 })!.title).toBe('Merc Card');
      expect(buildCard('CITY_OF_MIST', { cardType: 'CHARACTER_CARD', powerTagsCount: 0, weaknessTagsCount: 0 })!.title).toBe('Rift Card');
   });

   it('mints fresh ids on every call', () => {
      const a = buildCard('LEGENDS', themeOptions())!;
      const b = buildCard('LEGENDS', themeOptions())!;
      expect(a.id).not.toBe(b.id);
   });

   it('returns null for a game/type combo with no card (never offered by the dialog)', () => {
      expect(buildCard('LEGENDS', themeOptions({ cardType: 'LOADOUT_THEME' }))).toBeNull();
   });
});
