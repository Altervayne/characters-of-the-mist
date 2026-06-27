// -- Library Imports --
import cuid from 'cuid';

// -- Type Imports --
import type { DiceTrayDie, DiceTrayModifier } from '@/lib/dice/diceTrayTypes';

/*
 * Parses a dice formula like `1d6+2d12+4-2` into a built tray (dice + modifiers). Pure and framework-free:
 * the command input is a thin shell over this. The input is a sequence of SIGNED terms - the first term's
 * sign is optional (defaults to +), every later term must carry one. A term is either dice (`NdM` / `dM`,
 * N defaulting to 1, M an integer >= 2; a `-` makes them negative penalty dice) or a bare integer (a
 * MODIFIER of that signed value). Each constant becomes its OWN modifier row - `+4-2` is a +4 and a -2,
 * never combined. Any unparseable input yields `{ error }` and the caller leaves the tray untouched.
 */

export interface DiceCommand {
   dice: DiceTrayDie[];
   modifiers: DiceTrayModifier[];
}

/** One parsed term: a run of dice, or a single constant modifier. */
type Term =
   | { kind: 'dice'; count: number; sides: number; negative: boolean }
   | { kind: 'modifier'; value: number };

// The first term's sign is optional; later terms require one. Each matches dice (`NdM`/`dM`) or a constant.
const FIRST_TERM = /^([+-]?)(?:(\d*)d(\d+)|(\d+))/;
const NEXT_TERM = /^([+-])(?:(\d*)d(\d+)|(\d+))/;

export function parseDiceCommand(input: string): DiceCommand | { error: string } {
   const cleaned = input.replace(/\s+/g, '').toLowerCase();
   if (cleaned === '') return { error: 'empty' };

   const terms: Term[] = [];
   let pos = 0;
   let first = true;
   while (pos < cleaned.length) {
      const match = (first ? FIRST_TERM : NEXT_TERM).exec(cleaned.slice(pos));
      if (!match) return { error: 'unexpected' };
      const [whole, sign, diceCount, diceSides, constant] = match;

      if (diceSides !== undefined) {
         const sides = parseInt(diceSides, 10);
         const count = diceCount === '' ? 1 : parseInt(diceCount, 10);
         // M must be a real die (>= 2 faces); N must roll at least one die.
         if (sides < 2 || count < 1) return { error: 'invalid-die' };
         terms.push({ kind: 'dice', count, sides, negative: sign === '-' });
      } else {
         const value = parseInt(constant, 10);
         terms.push({ kind: 'modifier', value: sign === '-' ? -value : value });
      }

      pos += whole.length;
      first = false;
   }

   // Fully parsed: expand into fresh-id dice + modifiers, so they behave like hand-added ones.
   const dice: DiceTrayDie[] = [];
   const modifiers: DiceTrayModifier[] = [];
   for (const term of terms) {
      if (term.kind === 'dice') {
         for (let i = 0; i < term.count; i++) {
            dice.push(term.negative ? { id: cuid(), sides: term.sides, negative: true } : { id: cuid(), sides: term.sides });
         }
      } else {
         modifiers.push({ id: cuid(), value: term.value });
      }
   }
   return { dice, modifiers };
}
