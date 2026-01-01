import { useState, useEffect } from 'react';

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

  // Sync external changes back to local state
  useEffect(() => {
    setLocalValue(externalValue);
  }, [externalValue]);

  return [localValue, setLocalValue];
}
