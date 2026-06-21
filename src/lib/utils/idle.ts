/*
 * A wrapper over `requestIdleCallback` with a `setTimeout` fallback for engines that
 * lack it (older Safari, jsdom). Schedules non-urgent work so it never competes with
 * first paint or an active edit. Returns a handle to cancel it.
 */

/** Cancels a scheduled idle callback. */
export interface IdleHandle {
   cancel: () => void;
}

/**
 * Runs `callback` once the browser is idle (or after `timeoutMs` at the latest).
 * Falls back to `setTimeout` where `requestIdleCallback` is unavailable.
 *
 * @param callback - The work to run when idle.
 * @param timeoutMs - Upper bound before the callback is forced to run.
 * @returns A handle whose `cancel()` prevents the pending callback from firing.
 */
export function runWhenIdle(callback: () => void, timeoutMs = 2000): IdleHandle {
   if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(callback, { timeout: timeoutMs });
      return { cancel: () => window.cancelIdleCallback?.(handle) };
   }
   const handle = window.setTimeout(callback, 0);
   return { cancel: () => window.clearTimeout(handle) };
}
