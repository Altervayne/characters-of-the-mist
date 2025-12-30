import { createJSONStorage } from 'zustand/middleware';

/**
 * Creates a debounced localStorage implementation.
 * Debounces setItem calls to reduce write frequency.
 *
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns Storage object compatible with localStorage interface
 */
function createDebouncedLocalStorage(delay: number = 300): Storage {
    const storage = localStorage;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const pendingWrites = new Map<string, string>();

    const flushWrites = () => {
        pendingWrites.forEach((value, key) => {
            storage.setItem(key, value);
        });
        pendingWrites.clear();
        timeoutId = null;
    };

    // Flush writes on page unload to prevent data loss
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
            if (pendingWrites.size > 0) {
                flushWrites();
            }
        });
    }

    return {
        getItem: (name: string): string | null => {
            // Check pending writes first (not yet flushed to storage)
            if (pendingWrites.has(name)) {
                return pendingWrites.get(name)!;
            }
            return storage.getItem(name);
        },

        setItem: (name: string, value: string): void => {
            pendingWrites.set(name, value);

            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(flushWrites, delay);
        },

        removeItem: (name: string): void => {
            pendingWrites.delete(name);
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
            storage.removeItem(name);
        },

        clear: () => {
            pendingWrites.clear();
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
            storage.clear();
        },

        key: (index: number): string | null => {
            return storage.key(index);
        },

        get length(): number {
            return storage.length;
        },
    };
}

/**
 * Creates a debounced storage wrapper for Zustand persist middleware.
 * Debounces setItem calls to reduce localStorage write frequency.
 *
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns StateStorage interface compatible with Zustand persist
 */
export function createDebouncedStorage(delay: number = 300) {
    return createJSONStorage(() => createDebouncedLocalStorage(delay));
}
