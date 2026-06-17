import cuid from "cuid";

/*
 * Drawer shared utilities.
 *
 * The recursive nested-tree operations that once lived here (add/rename/delete/
 * move/reorder...Recursively, findAndRemove*, findFolder*, buildBreadcrumb,
 * getItemDisplayPath, findItemFolder, mergeIntoFolderRecursively, ...) were retired
 * in the IndexedDB migration (spec §7.1): the drawer is now flat Dexie records and
 * those operations are served by `@/lib/drawer/drawerRepository`.
 *
 * Only `deepReId` and `reorderList` remain - they are generic helpers still used
 * by `characterStore` (out of migration scope) and the new Dexie layer, so per
 * spec §8.1 (Conflict C-1) this file is kept rather than deleted.
 */

/**
 * Recursively clones an object and regenerates all `id` fields with fresh cuids.
 * Useful when duplicating drawer items or folders - ensures every copy gets unique IDs.
 */
export function deepReId<T extends object>(obj: T): T {
   if (obj === null || typeof obj !== 'object') {
      return obj;
   }

   if (Array.isArray(obj)) {
      return obj.map(item => (typeof item === 'object' && item !== null ? deepReId(item) : item)) as T;
   }

   // Using any here is perfectly intentional, as it could quite literally be
   // any object.
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const newObj: { [key: string]: unknown } = { ...obj as any };
   if ('id' in newObj && typeof newObj.id === 'string') {
      newObj.id = cuid();
   }

   for (const key in newObj) {
      if (Object.prototype.hasOwnProperty.call(newObj, key)) {
         const value = newObj[key];
         if (typeof value === 'object' && value !== null) {
            newObj[key] = deepReId(value as T);
         }
      }
   }

   return newObj as T;
};

/**
 * Reorders items in a list by moving an item from one index to another.
 * Used for drag-and-drop reordering of cards, trackers, folders, and drawer items.
 */
export function reorderList<T>(list: T[], startIndex: number, endIndex: number): T[] {
   const result = Array.from(list);
   const [removed] = result.splice(startIndex, 1);
   result.splice(endIndex, 0, removed);
   return result;
};
