// -- React Imports --
import { createContext } from 'react';

/*
 * The heading -> slug bridge for the shared document heading components. A note reading view provides a
 * resolver built from `extractHeadings`, so each rendered heading gets `id={slug}` matching the outline rail
 * (and future `#slug` links). Lives in its own `.ts` module so the component file stays fast-refresh-clean.
 */

/** Resolves a rendered heading to its anchor slug, from its source offset + plain text. Undefined = no id. */
export type HeadingSlugResolver = (offset: number | undefined, text: string) => string | undefined;

/** Provides the heading->slug resolver to the shared heading components. Null = don't emit ids. */
export const HeadingSlugContext = createContext<HeadingSlugResolver | null>(null);
