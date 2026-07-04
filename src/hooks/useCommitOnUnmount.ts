// -- React Imports --
import { useEffect, useRef } from 'react';

/*
 * Flushes a buffered edit once when the component unmounts. A board note commits its text on blur, but
 * switching tabs unmounts the board WITHOUT a blur (React fires no blur on a focused input's unmount), so
 * the buffered edit is silently dropped. The latest-ref pattern is mandatory: the unmount cleanup must call
 * the CURRENT commit closure (a naive `() => commit()` would capture the first render's empty buffer).
 * The commit stays dirty-guarded by its caller, so a normal blur-then-unmount flush no-ops.
 */
export function useCommitOnUnmount(commit: () => void): void {
   const ref = useRef(commit);
   useEffect(() => { ref.current = commit; });
   useEffect(() => () => ref.current(), []);
}
