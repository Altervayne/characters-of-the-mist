/*
 * Board-agnostic dice-tray data shapes. The tray (a list of dice + labeled modifiers, an optional title,
 * and a cached last roll) is now used in more than one place, so its content type lives here, free of any
 * board coupling. The board's `DiceTrayBoardContent` is just this plus the board item's `kind` tag.
 */

/** The standard polyhedral die faces (the quick-pick set + the shapes with a real projection). */
export type DieSides = 4 | 6 | 8 | 10 | 12 | 20 | 100;

/**
 * One die in a tray: a stable id (so a cached roll maps to it) and its face count. `sides` is any integer
 * >= 2 (a d2 coin, the platonic set, or an arbitrary "weird" die like a d63); `negative` marks a penalty
 * die whose rolled value SUBTRACTS from the total.
 */
export interface DiceTrayDie {
   id: string;
   sides: number;
   negative?: boolean;
}

/** One labeled modifier on a tray: an optional label and a signed value (config, undoable). */
export interface DiceTrayModifier {
   id: string;
   label?: string;
   value: number;
}

/** A cached roll: each die's face by id, the modifier breakdown at roll time, and the grand total. */
export interface DiceTrayLastRoll {
   faces: Record<string, number>;
   modifiers: { label?: string; value: number }[];
   total: number;
}

/**
 * One past roll in a tray's history: enough to DISPLAY it (faces in dice order + breakdown + total + when)
 * AND to RESTORE its setup (the dice + modifiers it was rolled with). Self-contained (no id references) so
 * it survives independently of the tray's current dice.
 */
export interface RollEntry {
   id: string;
   at: number;
   dice: { sides: number; negative?: boolean }[];
   modifiers: { label?: string; value: number }[];
   faces: number[];
   total: number;
}

/**
 * A persistent preset roller: a list of individual dice plus a list of labeled modifiers (and an optional
 * title). The CONFIG (dice / modifiers / title) is the consumer's undoable state; the `lastRoll` is the
 * CACHED last result, written via the consumer's non-undoable path so it survives reload + save/export
 * without ever landing on an undo stack.
 */
export interface DiceTrayContent {
   /** Optional label, e.g. "Attack". */
   title?: string;
   /** The individual dice (config). */
   dice: DiceTrayDie[];
   /** The labeled modifiers added to the dice subtotal (config). */
   modifiers: DiceTrayModifier[];
   /** The last roll, cached (not undoable). */
   lastRoll?: DiceTrayLastRoll;
   /** Recent rolls, newest first, capped (not undoable); travels with the tray on copy / export. */
   history?: RollEntry[];
}
