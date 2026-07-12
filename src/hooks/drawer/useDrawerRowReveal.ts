// -- React Imports --
import { useEffect, useRef } from 'react';

// -- Store Imports --
import { useDrawerStore } from '@/lib/stores/drawerStore';

/*
 * Drives the one-shot "reveal" of a drawer row: when a Portal reveal-in-drawer flags this item, the row
 * scrolls into view and (via the returned flag + the `animate-drawer-reveal` utility) pulses once. The
 * transient signal lives on the drawer store and auto-clears, so this only reads it. Reduced-motion
 * readers get an instant scroll and, since the pulse is gated with `motion-safe:`, no flash.
 */

/**
 * @param itemId The drawer item id this row renders.
 * @returns `ref` to attach to the row's outer element (the scroll target) and `isRevealed` to drive the
 *   `motion-safe:animate-drawer-reveal` pulse class.
 */
export function useDrawerRowReveal(itemId: string): { ref: React.RefObject<HTMLDivElement | null>; isRevealed: boolean } {
   const ref = useRef<HTMLDivElement>(null);
   const isRevealed = useDrawerStore((state) => state.highlightItemId === itemId);

   useEffect(() => {
      if (!isRevealed) return;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      ref.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
   }, [isRevealed]);

   return { ref, isRevealed };
}
