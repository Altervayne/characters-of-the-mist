// -- React Imports --
import { useCallback, useEffect, useState } from 'react';

// -- Store Imports --
import { activeSearchFilters, isSearchFilterActive, useDrawerActions, useDrawerStore } from '@/lib/stores/drawerStore';

/**
 * Owns the drawer search field's text + debounce, and exposes the store's search state.
 *
 * The text field MERGES into the active criteria (so it composes with the filter panel): a non-empty
 * value (debounced 250ms) sets `text`; emptying it clears just `text` - returning to browse only when
 * no other filter remains. `isSearchActive` is any active filter (text OR types/games/dates), so
 * filtering by a type alone is a valid search; sort alone is not.
 *
 * @returns The field `text` + `setText`, a `clear` that empties it, and the reactive
 *   `isSearchActive` / `results` / `resultCount` / `activeFilterCount`.
 */
export function useDrawerSearch() {
   const { updateSearchCriteria, clearSearch } = useDrawerActions();
   const [text, setText] = useState('');

   const searchCriteria = useDrawerStore((state) => state.searchCriteria);
   const results = useDrawerStore((state) => state.searchResults);
   const isSearching = useDrawerStore((state) => state.isSearching);
   const isSearchActive = isSearchFilterActive(searchCriteria);

   useEffect(() => {
      const trimmed = text.trim();
      if (!trimmed) {
         // Empty text: keep filtering if another criterion is active, else return to browse (no query).
         const current = useDrawerStore.getState().searchCriteria;
         if (isSearchFilterActive({ ...(current ?? {}), text: undefined })) {
            void updateSearchCriteria({ text: undefined });
         } else {
            clearSearch();
         }
         return;
      }
      const timer = setTimeout(() => void updateSearchCriteria({ text: trimmed }), 250);
      return () => clearTimeout(timer);
   }, [text, updateSearchCriteria, clearSearch]);

   const clear = useCallback(() => setText(''), []);

   return {
      text,
      setText,
      clear,
      isSearchActive,
      results,
      isSearching,
      resultCount: results?.length ?? 0,
      activeFilterCount: activeSearchFilters(searchCriteria).length,
   };
}
