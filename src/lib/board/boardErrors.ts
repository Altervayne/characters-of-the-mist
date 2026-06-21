/**
 * Typed errors thrown by the board repository.
 *
 * Mirrors `drawerErrors.ts`: the repository throws and never swallows; it has no UI
 * concerns (no toasts, no console). The store/command layer that wraps it is the
 * single place that catches these and surfaces them. Each error carries a stable
 * `code` so callers can branch without string-matching messages.
 */

/** A board or board item referenced by id does not exist. */
export class BoardNotFoundError extends Error {
   readonly code = 'BOARD_NOT_FOUND';
   constructor(message: string) {
      super(message);
      this.name = 'BoardNotFoundError';
   }
}

/**
 * A Dexie/IndexedDB board transaction failed and was rolled back. Wraps the
 * underlying cause so the original failure is not lost.
 */
export class BoardTransactionError extends Error {
   readonly code = 'BOARD_TRANSACTION_FAILED';
   constructor(message: string, options?: { cause?: unknown }) {
      super(message, options);
      this.name = 'BoardTransactionError';
   }
}
