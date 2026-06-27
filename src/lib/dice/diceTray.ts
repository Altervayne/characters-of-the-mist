// -- Library Imports --
import cuid from 'cuid';

// -- Type Imports --
import type { DiceTrayContent, DiceTrayDie, DiceTrayModifier, DieSides } from '@/lib/dice/diceTrayTypes';

/*
 * The dice-tray roll + the legacy-shape migration. The roll is a pure function over the
 * tray's die LIST; its result is never stored as content (the body holds the live faces and
 * caches the settled roll separately), so this stays framework-free and easy to test with an
 * injected RNG.
 */

/** The die faces a tray can hold, ascending - also the picker / display order. */
export const DIE_SIDES: DieSides[] = [4, 6, 8, 10, 12, 20, 100];

/** One die's outcome: which die (by id) and the value it landed on. */
export interface DieFace {
   id: string;
   sides: DieSides;
   value: number;
}

/** A full roll: each die's face, the dice subtotal, the labeled modifier breakdown, and the grand total. */
export interface DiceTrayResult {
   faces: DieFace[];
   diceTotal: number;
   modifiers: { label?: string; value: number }[];
   modifierTotal: number;
   total: number;
}

/**
 * Rolls a tray's dice (each lands on `1..sides`) and adds every modifier's value. `rng`
 * (default `Math.random`) is injectable so tests are deterministic. The result keeps the
 * per-modifier breakdown for display, never collapsing to one number. Empty lists are fine
 * (a roll with no dice/modifiers yields 0).
 */
export function rollDiceTray(dice: DiceTrayDie[], modifiers: DiceTrayModifier[], rng: () => number = Math.random): DiceTrayResult {
   const faces: DieFace[] = [];
   let diceTotal = 0;
   for (const die of dice) {
      const value = 1 + Math.floor(rng() * die.sides);
      faces.push({ id: die.id, sides: die.sides, value });
      diceTotal += value;
   }
   const breakdown = modifiers.map((modifier) => ({ label: modifier.label, value: modifier.value }));
   const modifierTotal = breakdown.reduce((sum, modifier) => sum + modifier.value, 0);
   return { faces, diceTotal, modifiers: breakdown, modifierTotal, total: diceTotal + modifierTotal };
}

/**
 * Normalizes a tray's content to the current LIST shapes: dice from the old count-map
 * (`dice: { 6: 2 }`) into individual dice, and the old flat `modifier: N` into a one-entry
 * modifier list (`N !== 0 ? [{value:N}] : []`), losslessly. Idempotent: a tray already on
 * the list shapes is returned unchanged. Generic over the concrete content so a caller keeps
 * its own shape (e.g. the board adds `kind`). Runs defensively wherever a tray's content is
 * read, since there is no central harmonize pass.
 */
export function migrateDiceTrayContent<T extends DiceTrayContent>(content: T): T {
   // Runtime-typed: legacy data violates the current types, so read the fields as unknown.
   const raw = content as unknown as { dice?: unknown; modifiers?: unknown; modifier?: unknown };

   const diceMigrated = !Array.isArray(raw.dice);
   const dice: DiceTrayDie[] = diceMigrated ? expandCounts(raw.dice) : (raw.dice as DiceTrayDie[]);

   const modifiersMigrated = !Array.isArray(raw.modifiers);
   const modifiers: DiceTrayModifier[] = modifiersMigrated
      ? typeof raw.modifier === 'number' && raw.modifier !== 0 ? [{ id: cuid(), value: raw.modifier }] : []
      : (raw.modifiers as DiceTrayModifier[]);

   if (!diceMigrated && !modifiersMigrated) return content;
   const next = { ...content, dice, modifiers } as T;
   delete (next as { modifier?: unknown }).modifier; // drop the legacy flat field
   return next;
}

/** Expands a legacy `dice` count-map into individual dice with fresh ids. */
function expandCounts(dice: unknown): DiceTrayDie[] {
   const counts = (dice ?? {}) as Partial<Record<DieSides, number>>;
   const expanded: DiceTrayDie[] = [];
   for (const sides of DIE_SIDES) {
      const count = counts[sides] ?? 0;
      for (let i = 0; i < count; i++) expanded.push({ id: cuid(), sides });
   }
   return expanded;
}
