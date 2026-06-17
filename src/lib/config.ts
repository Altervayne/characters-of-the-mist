// Bump whenever a new data harmonization needs to run on rehydrate (the zustand
// persist `migrate` callback only fires when this differs from the persisted
// value).
//
// SCOPE NOTE (migration spec §6.5 / Conflict C-2): as of the drawer's IndexedDB
// migration, this constant now drives ONLY the character store. The drawer no
// longer uses zustand persist/`migrate`; it is versioned via Dexie
// (`drawerDatabase` `version(n)` + `meta.schemaVersion`). So bumping STORE_VERSION
// re-runs the character store's harmonization only, never the drawer's.
export const STORE_VERSION = 3

export const APP_VERSION = '1.3.1';