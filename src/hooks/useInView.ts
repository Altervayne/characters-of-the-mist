// -- React Imports --
import { useEffect, useRef, useState, type RefObject } from 'react';

/*
 * A latched visibility gate: `hasBeenVisible` flips true the first time the element enters the viewport
 * (with a rootMargin so it preloads slightly ahead) and NEVER resets. Drives "load only what's seen" -
 * an off-screen card stays a skeleton and never mounts its content fetch, and a card scrolled away once
 * stays loaded (no re-fetch thrash on scroll-back).
 */

/** Latch: once anything intersects, stay true forever. Pure, so the latch rule is testable. */
export function computeLatch(previous: boolean, entries: IntersectionObserverEntry[]): boolean {
   return previous || entries.some((entry) => entry.isIntersecting);
}

export function useInView<T extends Element>(rootMargin = '200px'): { ref: RefObject<T | null>; hasBeenVisible: boolean } {
   const ref = useRef<T>(null);
   const [hasBeenVisible, setHasBeenVisible] = useState(false);

   useEffect(() => {
      const element = ref.current;
      if (!element || hasBeenVisible) return;
      const observer = new IntersectionObserver(
         (entries) => setHasBeenVisible((previous) => computeLatch(previous, entries)),
         { rootMargin },
      );
      observer.observe(element);
      return () => observer.disconnect();
   }, [hasBeenVisible, rootMargin]);

   return { ref, hasBeenVisible };
}
