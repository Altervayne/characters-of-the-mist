// -- Other Library Imports --
import cuid from 'cuid';

// -- Type Imports --
import type { BlandTag, ChallengeAbility, ChallengeStatus } from '@/lib/types/character';

/*
 * Shared row factories + pure list helpers for the Challenge Card's Limits / Statuses / Tags / Abilities
 * lists. Both the dialog editor and the card's inline edit rows mint rows and mutate lists through these,
 * so a fresh row always has the same shape/id scheme regardless of which surface created it.
 */

/** A fresh limit/status row: an empty name at tier 1. */
export const newStatus = (): ChallengeStatus => ({ id: cuid(), name: '', tier: 1 });

/** A fresh tag row: an empty name. */
export const newTag = (): BlandTag => ({ id: cuid(), name: '' });

/** A fresh Threats & Consequences ability row: empty tag/flavor, no consequences yet. */
export const newAbility = (): ChallengeAbility => ({ id: cuid(), tag: '', flavor: '', consequences: [] });

/** A fresh consequence row: an empty line of text, id-keyed so edits survive reorders/deletes. */
export const newConsequence = (): { id: string; text: string } => ({ id: cuid(), text: '' });

/** Appends a fresh row to a list. */
export function addRow<T>(list: T[], row: T): T[] {
   return [...list, row];
}

/** Replaces the row with `id` by merging `updates` into it; other rows are untouched. */
export function updateRowById<T extends { id: string }>(list: T[], id: string, updates: Partial<T>): T[] {
   return list.map((row) => (row.id === id ? { ...row, ...updates } : row));
}

/** Drops the row with `id`. */
export function removeRowById<T extends { id: string }>(list: T[], id: string): T[] {
   return list.filter((row) => row.id !== id);
}
