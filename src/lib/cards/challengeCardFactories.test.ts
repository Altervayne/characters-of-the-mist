import { describe, expect, it } from 'vitest';

import { addRow, newAbility, newConsequence, newStatus, newTag, patchAbilityById, removeRowById, resolveExpandedFocus, updateRowById } from './challengeCardFactories';
import type { BlandTag, ChallengeAbility, ChallengeStatus } from '@/lib/types/character';

/*
 * The Challenge Card's shared row factories + pure list helpers: fresh row shapes/ids for
 * newStatus/newTag/newAbility/newConsequence, and the add/update/remove helpers staying immutable
 * and no-op on a missing id.
 */

describe('newStatus', () => {
   it('mints an empty tier-1 row', () => {
      expect(newStatus()).toMatchObject({ name: '', tier: 1 });
   });

   it('gives every row a non-empty, unique id', () => {
      const a = newStatus();
      const b = newStatus();
      expect(a.id).toBeTruthy();
      expect(a.id).not.toBe(b.id);
   });
});

describe('newTag', () => {
   it('mints an empty BlandTag with no isActive/isScratched', () => {
      const tag = newTag();
      expect(tag).toMatchObject({ name: '' });
      expect(tag).not.toHaveProperty('isActive');
      expect(tag).not.toHaveProperty('isScratched');
   });

   it('gives every row a non-empty, unique id', () => {
      const a = newTag();
      const b = newTag();
      expect(a.id).toBeTruthy();
      expect(a.id).not.toBe(b.id);
   });
});

describe('newAbility', () => {
   it('mints an empty ability with no consequences', () => {
      expect(newAbility()).toMatchObject({ tag: '', flavor: '', consequences: [] });
   });

   it('gives every row a non-empty, unique id', () => {
      const a = newAbility();
      const b = newAbility();
      expect(a.id).toBeTruthy();
      expect(a.id).not.toBe(b.id);
   });
});

describe('newConsequence', () => {
   it('mints an empty text row', () => {
      expect(newConsequence()).toMatchObject({ text: '' });
   });

   it('gives every row a non-empty, unique id', () => {
      const a = newConsequence();
      const b = newConsequence();
      expect(a.id).toBeTruthy();
      expect(a.id).not.toBe(b.id);
   });
});

describe('addRow', () => {
   it('returns a new array with the row appended, leaving the original untouched', () => {
      const original: BlandTag[] = [{ id: 't1', name: 'fast' }];
      const row: BlandTag = { id: 't2', name: 'sneaky' };

      const result = addRow(original, row);

      expect(result).toEqual([{ id: 't1', name: 'fast' }, { id: 't2', name: 'sneaky' }]);
      expect(original).toEqual([{ id: 't1', name: 'fast' }]);
      expect(result).not.toBe(original);
   });
});

describe('updateRowById', () => {
   const list = (): ChallengeStatus[] => [
      { id: 's1', name: 'bloodied', tier: 2 },
      { id: 's2', name: 'winded', tier: 1 },
   ];

   it('merges the patch into the matching row only, returning a new array', () => {
      const original = list();

      const result = updateRowById(original, 's1', { tier: 3 });

      expect(result).toEqual([
         { id: 's1', name: 'bloodied', tier: 3 },
         { id: 's2', name: 'winded', tier: 1 },
      ]);
      expect(original).toEqual(list());
      expect(result).not.toBe(original);
   });

   it('is a no-op when the id is absent', () => {
      const original = list();
      expect(updateRowById(original, 'missing', { tier: 9 })).toEqual(original);
   });
});

describe('removeRowById', () => {
   const list = (): BlandTag[] => [
      { id: 't1', name: 'fast' },
      { id: 't2', name: 'sneaky' },
   ];

   it('drops only the matching row, leaving the original untouched', () => {
      const original = list();

      const result = removeRowById(original, 't1');

      expect(result).toEqual([{ id: 't2', name: 'sneaky' }]);
      expect(original).toEqual(list());
   });

   it('is a no-op when the id is absent', () => {
      const original = list();
      expect(removeRowById(original, 'missing')).toEqual(original);
   });
});

describe('patchAbilityById', () => {
   const abilities = (): ChallengeAbility[] => [
      { id: 'a1', tag: 'Bite', flavor: 'sinks in', consequences: [] },
      { id: 'a2', tag: 'Claw', flavor: '', consequences: [] },
   ];

   it('runs the mutator over the LIVE matching row and returns a new array', () => {
      const original = abilities();

      const result = patchAbilityById(original, 'a1', (current) => ({ ...current, tag: 'Gore' }));

      expect(result).toEqual([
         { id: 'a1', tag: 'Gore', flavor: 'sinks in', consequences: [] },
         { id: 'a2', tag: 'Claw', flavor: '', consequences: [] },
      ]);
      expect(original).toEqual(abilities());
      expect(result).not.toBe(original);
   });

   it('returns the same array reference (no-op) when the id is absent', () => {
      const original = abilities();
      expect(patchAbilityById(original, 'missing', (current) => ({ ...current, tag: 'x' }))).toBe(original);
   });
});

describe('resolveExpandedFocus', () => {
   const abilities = (): ChallengeAbility[] => [
      { id: 'a1', tag: 'Bite', flavor: '', consequences: [] },
      { id: 'a2', tag: 'Claw', flavor: '', consequences: [] },
   ];

   it('keeps the current focus while its ability still exists', () => {
      expect(resolveExpandedFocus(abilities(), 'a2')).toBe('a2');
   });

   it('falls back to the first ability when the focused id was removed', () => {
      expect(resolveExpandedFocus(abilities(), 'gone')).toBe('a1');
   });

   it('falls back to the first ability when nothing is focused yet', () => {
      expect(resolveExpandedFocus(abilities(), null)).toBe('a1');
   });

   it('resolves to null on an empty list', () => {
      expect(resolveExpandedFocus([], 'a1')).toBeNull();
      expect(resolveExpandedFocus([], null)).toBeNull();
   });
});
