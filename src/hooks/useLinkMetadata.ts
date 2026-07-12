// -- React Imports --
import { useEffect, useState } from 'react';

// -- Portals Imports --
import {
   getCachedLinkMetadata,
   loadLinkMetadata,
   resolveLocalLinkMetadata,
   subscribeLinkMetadata,
} from '@/lib/portals/linkMetadata';

// -- Type Imports --
import type { LinkTarget } from '@/lib/portals/linkTarget';
import type { LinkMetadata } from '@/lib/portals/linkMetadata';
import type { NoteHeading } from '@/lib/notes/noteOutline';

/*
 * A link target's liveness + naming, shared by every surface that renders a link/portal (the Reading chip, the
 * CM6 live widget, and the board portal tile) so none of them re-implement the drawer resolve. A section/external
 * is known synchronously (from the note's `headings`); an entity/element loads from the drawer cache and re-reads
 * on cache changes (a load settling, a rename/delete). An UNRESOLVED drawer lookup reads as `undefined` (UNKNOWN),
 * which every surface renders in the normal LIVE state - "dead" shows ONLY on a confirmed miss, never a flash.
 *
 * A `null` target (a portal variant with no resolver mapping yet, e.g. `board-element`) resolves to `undefined`,
 * so such a portal reads live and never dead.
 */
export function useLinkMetadata(target: LinkTarget | null, headings: NoteHeading[]): LinkMetadata | undefined {
   const local = target ? resolveLocalLinkMetadata(target, headings) : null;
   const key = !target ? '' : target.kind === 'entity' ? `entity:${target.entity}:${target.id}` : target.kind === 'element' ? `element:${target.drawerItemId}` : '';
   const [cached, setCached] = useState<LinkMetadata | undefined>(() => (target ? getCachedLinkMetadata(target) : undefined));

   useEffect(() => {
      if (!target || local || !key) return; // section/external/null: resolved locally, no drawer read
      let cancelled = false;
      const sync = () => { if (!cancelled) setCached(getCachedLinkMetadata(target)); };
      sync();
      void loadLinkMetadata(target).then(sync);
      const unsubscribe = subscribeLinkMetadata(sync);
      return () => { cancelled = true; unsubscribe(); };
      // `target` is reconstructed each render from the same address; `key` is its stable identity.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [key, !local]);

   return local ?? cached;
}
