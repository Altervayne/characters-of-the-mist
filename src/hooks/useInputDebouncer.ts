import { useState, useEffect, useRef } from 'react';

/**
 * Hook for debouncing input values with automatic external state synchronization.
 *
 * This hook provides a local state that debounces updates to an external state,
 * preventing excessive re-renders and API calls while the user is typing.
 *
 * @template T - The type of the value being debounced
 * @param externalValue - The current value from external state (e.g., from a store)
 * @param onUpdate - Callback to update the external state with the new value
 * @param delay - Debounce delay in milliseconds (default: 500ms)
 * @returns A tuple of [localValue, setLocalValue] similar to useState
 *
 * @example
 * ```tsx
 * const [localName, setLocalName] = useInputDebouncer(
 *   character.name,
 *   (value) => actions.updateCharacterName(value)
 * );
 *
 * return <Input value={localName} onChange={(e) => setLocalName(e.target.value)} />;
 * ```
 */
export function useInputDebouncer<T>(
  externalValue: T,
  onUpdate: (value: T) => void,
  delay: number = 500
): [T, (value: T) => void] {
  const [localValue, setLocalValue] = useState<T>(externalValue);

  // Debounce updates to external state
  useEffect(() => {
    const handler = setTimeout(() => {
      if (externalValue !== localValue) {
        onUpdate(localValue);
      }
    }, delay);
    return () => clearTimeout(handler);
  }, [localValue, externalValue, onUpdate, delay]);

  // Flush the pending edit on unmount. The debounce timer's cleanup cancels its
  // write, so a tab/character switch (which unmounts the surface without a blur)
  // would otherwise drop the last keystrokes. The latest-ref is mandatory: it
  // holds the current render's closure so the flush commits the value the field
  // was bound to when it last rendered. Not a stale first-render one. Dirty-
  // guarded (localValue !== externalValue) so a debounce that already fired no-ops.
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = () => {
      if (externalValue !== localValue) {
        onUpdate(localValue);
      }
    };
  });
  useEffect(() => () => flushRef.current(), []);

  // Sync external changes (e.g., undo/redo) back into local state. This also
  // short-circuits any pending debounce: once localValue equals externalValue,
  // the first effect's guard (externalValue !== localValue) will be false on
  // the next timer fire, preventing a stale write-back to the store.
  useEffect(() => {
    setLocalValue(externalValue);
  }, [externalValue]);

  return [localValue, setLocalValue];
}
