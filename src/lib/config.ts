// Bump whenever a new data harmonization needs to run on rehydrate (the zustand
// persist `migrate` callback only fires when this differs from the persisted
// value). 1.3.0 added the BlandTag -> Tag upgrade for backpack / specials /
// nemeses, so this rose from 2 to 3.
export const STORE_VERSION = 3

export const APP_VERSION = '1.3.0';