// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { parseDiceCommand } from './diceCommand';

// -- Type Imports --
import type { DiceCommand } from './diceCommand';

/*
 * Tests for the dice-command parser. Ids are random, so assertions look at sides / negative / values and
 * counts, never the ids. A bad parse must return `{ error }` and (by contract) never a partial command.
 */

/** Narrows a parse result to the success shape, failing loudly if it errored. */
function parsed(input: string): DiceCommand {
   const result = parseDiceCommand(input);
   if ('error' in result) throw new Error(`expected "${input}" to parse, got error: ${result.error}`);
   return result;
}

describe('parseDiceCommand', () => {
   it('builds dice + separate modifier rows from a full command', () => {
      const { dice, modifiers } = parsed('1d6+2d12+4-2');
      expect(dice.map((d) => d.sides)).toEqual([6, 12, 12]);
      expect(dice.some((d) => d.negative)).toBe(false);
      // Each constant is its OWN row, never summed.
      expect(modifiers.map((m) => m.value)).toEqual([4, -2]);
      expect(modifiers.every((m) => m.label === undefined)).toBe(true);
   });

   it('defaults N to 1 for a bare dM', () => {
      const { dice, modifiers } = parsed('d20');
      expect(dice.map((d) => d.sides)).toEqual([20]);
      expect(modifiers).toEqual([]);
   });

   it('a minus sign makes the dice negative (penalty) dice', () => {
      const { dice } = parsed('-1d6');
      expect(dice).toHaveLength(1);
      expect(dice[0]).toMatchObject({ sides: 6, negative: true });
   });

   it('keeps two adjacent constants as two modifier rows (never combined)', () => {
      const { dice, modifiers } = parsed('+2-4');
      expect(dice).toEqual([]);
      expect(modifiers.map((m) => m.value)).toEqual([2, -4]);
   });

   it('accepts any sides >= 2 (a weird die like d63)', () => {
      const { dice } = parsed('4d63');
      expect(dice).toHaveLength(4);
      expect(dice.every((d) => d.sides === 63)).toBe(true);
   });

   it('is whitespace- and case-insensitive', () => {
      const { dice, modifiers } = parsed('  2D6 +  3 ');
      expect(dice.map((d) => d.sides)).toEqual([6, 6]);
      expect(modifiers.map((m) => m.value)).toEqual([3]);
   });

   it('gives every expanded die and modifier a distinct id', () => {
      const { dice, modifiers } = parsed('3d6+1');
      const ids = [...dice, ...modifiers].map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
   });

   it('treats a leading term with no sign as positive', () => {
      const { modifiers } = parsed('5');
      expect(modifiers).toEqual([{ id: expect.any(String), value: 5 }]);
   });

   it.each(['d1', 'd0', '2x6', '', '   ', '1d6++2', 'd', '1d', '+', 'abc'])(
      'returns an error and nothing else for invalid input %j',
      (input) => {
         const result = parseDiceCommand(input);
         expect('error' in result).toBe(true);
      },
   );
});
