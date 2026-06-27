// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { DIE_SIDES, QUICK_PICK, migrateDiceTrayContent, rollDiceTray } from './diceTray';

// -- Type Imports --
import type { DiceTrayContent, DiceTrayDie, DiceTrayModifier } from '@/lib/dice/diceTrayTypes';

/*
 * Tests for the pure dice-tray roll and the legacy migration. An injected RNG makes the
 * outcomes deterministic so value bounds, per-die mapping, and total math can be asserted.
 */

/** A scripted RNG returning each value in turn (cycling). */
function scriptedRng(values: number[]): () => number {
   let i = 0;
   return () => values[i++ % values.length];
}

const dice = (...defs: [string, DiceTrayDie['sides']][]): DiceTrayDie[] => defs.map(([id, sides]) => ({ id, sides }));
const mods = (...defs: [string, number, string?][]): DiceTrayModifier[] => defs.map(([id, value, label]) => ({ id, value, label }));

describe('rollDiceTray', () => {
   it('rolls one face per die, keyed by id, each within 1..sides', () => {
      const result = rollDiceTray(dice(['a', 6], ['b', 6], ['c', 20]), [], Math.random);
      expect(result.faces.map((f) => f.id)).toEqual(['a', 'b', 'c']);
      for (const face of result.faces) {
         expect(face.value).toBeGreaterThanOrEqual(1);
         expect(face.value).toBeLessThanOrEqual(face.sides);
      }
   });

   it('sums several modifiers and adds them to the dice (total = diceTotal + modifierTotal)', () => {
      // rng 0 -> value 1. 2d6 -> [1,1] = 2. Modifiers +2, -1 -> +1. Total 3.
      const result = rollDiceTray(dice(['a', 6], ['b', 6]), mods(['m1', 2, 'Strength'], ['m2', -1, 'Wounded']), () => 0);
      expect(result.diceTotal).toBe(2);
      expect(result.modifierTotal).toBe(1);
      expect(result.total).toBe(3);
   });

   it('keeps the per-modifier breakdown (label + value), never collapsing it', () => {
      const result = rollDiceTray([], mods(['m1', 2, 'Strength'], ['m2', -1, 'Wounded'], ['m3', 1]), () => 0);
      expect(result.modifiers).toEqual([
         { label: 'Strength', value: 2 },
         { label: 'Wounded', value: -1 },
         { label: undefined, value: 1 },
      ]);
      expect(result.modifierTotal).toBe(2);
      expect(result.total).toBe(2);
   });

   it('rolls a deterministic sequence with a scripted rng', () => {
      // 0 -> 1, 0.5 -> 4, 0.99 -> 6 on a d6.
      const result = rollDiceTray(dice(['a', 6], ['b', 6], ['c', 6]), mods(['m', 1]), scriptedRng([0, 0.5, 0.99]));
      expect(result.faces.map((f) => f.value)).toEqual([1, 4, 6]);
      expect(result.diceTotal).toBe(11);
      expect(result.total).toBe(12);
   });

   it('an empty tray with no modifiers totals zero', () => {
      const result = rollDiceTray([], [], () => 0);
      expect(result.faces).toEqual([]);
      expect(result.diceTotal).toBe(0);
      expect(result.modifierTotal).toBe(0);
      expect(result.total).toBe(0);
   });

   it('exposes the standard polyhedral set in ascending order', () => {
      expect(DIE_SIDES).toEqual([4, 6, 8, 10, 12, 20, 100]);
   });

   it('quick-pick is the coin plus the platonic set', () => {
      expect(QUICK_PICK).toEqual([2, 4, 6, 8, 10, 12, 20, 100]);
   });

   it('rolls arbitrary side counts within 1..sides (a coin and a weird die)', () => {
      const result = rollDiceTray(dice(['coin', 2], ['weird', 63]), [], Math.random);
      const [coin, weird] = result.faces;
      expect(coin.value).toBeGreaterThanOrEqual(1);
      expect(coin.value).toBeLessThanOrEqual(2);
      expect(weird.value).toBeGreaterThanOrEqual(1);
      expect(weird.value).toBeLessThanOrEqual(63);
   });

   it('subtracts a negative (penalty) die from the dice subtotal', () => {
      // rng 0.99 -> 6 on a d6. One positive (+6), one negative (-6) -> diceTotal 0.
      const penalty: DiceTrayDie[] = [{ id: 'a', sides: 6 }, { id: 'b', sides: 6, negative: true }];
      const result = rollDiceTray(penalty, [], () => 0.99);
      expect(result.faces.map((f) => f.value)).toEqual([6, 6]);
      expect(result.faces[1].negative).toBe(true);
      expect(result.diceTotal).toBe(0);
      expect(result.total).toBe(0);
   });

   it('a mixed tray sums positives, subtracts negatives, then adds modifiers', () => {
      // rng 0 -> 1 on every die. +d20 (1) + d6 (1) - d8 (1) = 1; modifier +2 -> total 3.
      const mixed: DiceTrayDie[] = [{ id: 'a', sides: 20 }, { id: 'b', sides: 6 }, { id: 'c', sides: 8, negative: true }];
      const result = rollDiceTray(mixed, mods(['m', 2, 'Bonus']), () => 0);
      expect(result.diceTotal).toBe(1);
      expect(result.modifierTotal).toBe(2);
      expect(result.total).toBe(3);
   });
});

describe('migrateDiceTrayContent', () => {
   it('expands a legacy count-map into individual dice and a flat modifier into a one-entry list', () => {
      // The old shape stored die counts and a single flat modifier.
      const legacy = { title: 'Old', dice: { 6: 2, 20: 1 }, modifier: -2 } as unknown as DiceTrayContent;
      const migrated = migrateDiceTrayContent(legacy);
      expect(migrated.dice.map((d) => d.sides)).toEqual([6, 6, 20]);
      expect(new Set(migrated.dice.map((d) => d.id)).size).toBe(3); // distinct ids
      // The modifier comes across losslessly as one unlabeled entry.
      expect(migrated.modifiers).toHaveLength(1);
      expect(migrated.modifiers[0]).toMatchObject({ value: -2 });
      expect(migrated.modifiers[0].label).toBeUndefined();
      expect((migrated as { modifier?: unknown }).modifier).toBeUndefined(); // legacy field dropped
      expect(migrated.title).toBe('Old');
   });

   it('a zero flat modifier migrates to an empty list', () => {
      const legacy = { dice: { 6: 1 }, modifier: 0 } as unknown as DiceTrayContent;
      expect(migrateDiceTrayContent(legacy).modifiers).toEqual([]);
   });

   it('is idempotent for a tray already on the list shapes', () => {
      const listShape: DiceTrayContent = { dice: dice(['a', 6]), modifiers: mods(['m', 2, 'Bonus']) };
      expect(migrateDiceTrayContent(listShape)).toBe(listShape);
   });

   it('migrates modifiers even when the dice are already a list', () => {
      const partial = { dice: dice(['a', 6]), modifier: 3 } as unknown as DiceTrayContent;
      const migrated = migrateDiceTrayContent(partial);
      expect(migrated.dice.map((d) => d.id)).toEqual(['a']); // dice untouched
      expect(migrated.modifiers).toEqual([{ id: expect.any(String), value: 3, label: undefined }]);
   });
});
