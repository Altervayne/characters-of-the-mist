/**
 * Typed errors thrown by the drawer repository.
 *
 * The repository throws and never swallows: it has no UI concerns (no toasts, no
 * console). The store layer that wraps it is the
 * single place that catches these, sets error state, and surfaces a notification.
 * Each error carries a stable `code` so callers can branch without string-matching
 * messages.
 */

/** A folder or item referenced by id does not exist. */
export class DrawerNotFoundError extends Error {
   readonly code = 'DRAWER_NOT_FOUND';
   constructor(message: string) {
      super(message);
      this.name = 'DrawerNotFoundError';
   }
}

/**
 * A requested operation is structurally invalid - e.g. moving a folder into
 * itself or one of its own descendants (which would create a cycle), or a
 * reorder index that falls outside the sibling set.
 */
export class DrawerInvalidOperationError extends Error {
   readonly code = 'DRAWER_INVALID_OPERATION';
   constructor(message: string) {
      super(message);
      this.name = 'DrawerInvalidOperationError';
   }
}

/**
 * A Dexie/IndexedDB transaction failed and was rolled back. Wraps the underlying
 * cause so the original failure is not lost.
 */
export class DrawerTransactionError extends Error {
   readonly code = 'DRAWER_TRANSACTION_FAILED';
   constructor(message: string, options?: { cause?: unknown }) {
      super(message, options);
      this.name = 'DrawerTransactionError';
   }
}
