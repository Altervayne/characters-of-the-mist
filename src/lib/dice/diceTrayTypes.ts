/*
 * Board-agnostic dice-tray data shapes. The tray (a list of dice + labeled modifiers, an optional title,
 * and a cached last roll) is now used in more than one place, so its content type lives here, free of any
 * board coupling. The board's `DiceTrayBoardContent` is just this plus the board item's `kind` tag.
 */

/** The standard polyhedral die faces a dice tray can hold. */
export type DieSides = 4 | 6 | 8 | 10 | 12 | 20 | 100;

/** One die in a tray: a stable id (so a cached roll maps to it) and its face count. */
export interface DiceTrayDie {
   id: string;
   sides: DieSides;
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
}
