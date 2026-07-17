// -- React Imports --
import { useEffect, useState } from 'react';

export interface SafeAreaInsets {
   top: number;
   right: number;
   bottom: number;
   left: number;
}

const ZERO: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Reads the four `env(safe-area-inset-*)` values off a throwaway hidden probe (they aren't otherwise
 * exposed to JS). Returns pixel numbers, 0 where unset - so desktop, and any device without a notch or
 * home indicator, reads all zeros and every caller becomes a no-op.
 */
export function getSafeAreaInsets(): SafeAreaInsets {
   if (typeof document === 'undefined') return ZERO;
   const probe = document.createElement('div');
   probe.style.cssText =
      'position:absolute;visibility:hidden;pointer-events:none;top:0;left:0;' +
      'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);' +
      'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);';
   document.body.appendChild(probe);
   const style = getComputedStyle(probe);
   const insets: SafeAreaInsets = {
      top: parseFloat(style.paddingTop) || 0,
      right: parseFloat(style.paddingRight) || 0,
      bottom: parseFloat(style.paddingBottom) || 0,
      left: parseFloat(style.paddingLeft) || 0,
   };
   probe.remove();
   return insets;
}

/** Memoized safe-area insets, re-probed on resize (orientation change reshuffles which edge carries the inset). */
export function useSafeAreaInsets(): SafeAreaInsets {
   const [insets, setInsets] = useState<SafeAreaInsets>(getSafeAreaInsets);
   useEffect(() => {
      const update = () => setInsets(getSafeAreaInsets());
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
   }, []);
   return insets;
}
