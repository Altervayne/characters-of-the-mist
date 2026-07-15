/** Default wait budget for an anchor to mount after a drive settles. */
export const ANCHOR_TIMEOUT_MS = 4000;

/**
 * Resolves a `data-tutorial="key"` anchor, waiting for it to mount rather than measuring
 * on a fixed timer. A drive that switches tabs or opens a panel mounts a lazy chunk
 * asynchronously; a MutationObserver resolves on the first match, or `null` after the
 * timeout. Event-driven, so it never races a cold chunk cache.
 */
export function resolveAnchor(key: string, timeoutMs: number = ANCHOR_TIMEOUT_MS): Promise<HTMLElement | null> {
   const selector = `[data-tutorial="${CSS.escape(key)}"]`;

   const immediate = document.querySelector<HTMLElement>(selector);
   if (immediate) return Promise.resolve(immediate);

   return new Promise((resolve) => {
      let settled = false;
      const finish = (element: HTMLElement | null) => {
         if (settled) return;
         settled = true;
         observer.disconnect();
         window.clearTimeout(timer);
         resolve(element);
      };

      const observer = new MutationObserver(() => {
         const element = document.querySelector<HTMLElement>(selector);
         if (element) finish(element);
      });
      observer.observe(document.body, { childList: true, subtree: true });

      const timer = window.setTimeout(() => finish(null), timeoutMs);

      // The node may have mounted between the initial query and observe(); re-check.
      const late = document.querySelector<HTMLElement>(selector);
      if (late) finish(late);
   });
}
