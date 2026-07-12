// -- Portals Imports --
import { portalTargetToLinkTarget } from '@/lib/portals/portalTarget';

// -- Type Imports --
import type { LinkTarget } from '@/lib/portals/linkTarget';
import type { LinkMetadata } from '@/lib/portals/linkMetadata';
import type { PortalStyle, PortalTarget } from '@/lib/types/board';

/*
 * A portal's DEAD-target logic, kept pure so both the tile and its tests read the same rules. A portal's targets
 * are drawer-backed (the picker only offers saved elements), so `linkMetadata` is the right liveness oracle -
 * but only for the resolvable kinds: an `external` target is ALWAYS live (no check), and `board-element` has no
 * resolver mapping in v1, so both are excluded here and read live (never dead).
 */

/**
 * The resolver target whose liveness a portal follows, or `null` for a kind with no liveness check (external is
 * always live; board-element is not resolvable yet). A `null` reads live - never dead.
 */
export function portalLivenessTarget(target: PortalTarget): LinkTarget | null {
   if (target.kind === 'external' || target.kind === 'board-element') return null;
   return portalTargetToLinkTarget(target);
}

/** Dead ONLY on a CONFIRMED miss (`exists === false`); UNKNOWN/loading metadata reads live (no dead flash). */
export function isPortalDead(metadata: LinkMetadata | undefined): boolean {
   return metadata?.exists === false;
}

/** A dead portal's struck label: the author's own label, else the cached last-known name, else empty. */
export function portalDeadLabel(style: PortalStyle, lastKnownName: string | undefined): string {
   return style.label || lastKnownName || '';
}
