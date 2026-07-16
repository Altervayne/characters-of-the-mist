// -- Asset Import --
import demoPortraitUrl from './demoPortrait.svg?url';

/*
 * The bundled placeholder image for the demo character's portrait. Imported as a bundle asset
 * (precached with the app shell, offline-safe), never fetched at runtime and never the asset
 * store. Consumed only by the portrait seam in `useAssetObjectUrl`.
 */

/** URL of the bundled demo-portrait placeholder. */
export const DEMO_PORTRAIT_URL: string = demoPortraitUrl;
