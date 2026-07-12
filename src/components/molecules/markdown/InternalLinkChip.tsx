// -- Library Imports --
import { Hash, Link2 } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { getItemTypeIconComponent } from '@/lib/utils/drawer-icons';

// -- Type Imports --
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { LinkTarget } from '@/lib/portals/linkTarget';

/*
 * The internal-link CHIP: a quiet inline pill for a note-body link that points somewhere inside the app
 * (a section, an entity tab, or a tabless element). The class-strings are EXPORTED so the CM6 live-editor
 * widget renders a byte-identical chip (Live == Reading), the same single-source trick the mention pill uses.
 *
 * Unlike a mention pill it carries NO saturated fill (the note body is paper, not chrome) - a `currentColor`
 * tint + a leading per-type icon is the whole affordance, so it never fights the parchment the way a
 * `--primary` fill would. External links are NOT chips: they stay the plain underlined link.
 */

/** The chip container classes, shared with the live widget so the two render paths cannot drift. */
export const INTERNAL_LINK_CHIP = 'inline-flex items-center gap-1 rounded bg-current/8 px-1 py-0.5 align-middle font-medium no-underline transition-colors hover:bg-current/15';
/** The leading icon sizing, shared with the live widget. */
export const INTERNAL_LINK_ICON = 'inline-block h-[0.95em] w-[0.95em] shrink-0 opacity-80';

/** Maps an entity link to the drawer item type whose icon represents it, so a chip matches its drawer glyph. */
const ENTITY_ITEM_TYPE = { note: 'NOTE', board: 'FULL_BOARD', character: 'FULL_CHARACTER_SHEET' } as const;

/**
 * The lucide icon component for a link target: a section is a `Hash`; an entity reuses the drawer icon for its
 * type; a tabless element gets a generic link glyph (its concrete type isn't known from the href alone). The
 * live widget mirrors this selection with inline SVG (see `internalLinkIconSvg`).
 */
export function iconForTarget(target: LinkTarget): LucideIcon {
   if (target.kind === 'section') return Hash;
   if (target.kind === 'entity') return getItemTypeIconComponent(ENTITY_ITEM_TYPE[target.entity]);
   return Link2;
}

/** A fallback chip label for an empty-text link, from the target's own address (proper naming lands in Phase 4). */
export function linkChipFallbackLabel(target: LinkTarget): string {
   if (target.kind === 'section') return `#${target.slug}`;
   if (target.kind === 'entity') return target.id;
   if (target.kind === 'element') return target.drawerItemId;
   return target.href;
}

/**
 * The Reading-side chip (react-markdown `a` override). Renders the link text behind a per-type icon on the
 * shared tint; a plain click resolves the link (never navigates the anchor) while the pointerdown guard keeps
 * a tap on a draggable surface (a board tile) from starting a drag.
 */
export function InternalLinkChip({ target, href, onActivate, children }: {
   target: LinkTarget;
   href: string;
   onActivate?: (href: string) => void;
   children: ReactNode;
}) {
   // `iconForTarget` returns one of a handful of stable, module-level lucide components per target - it never
   // constructs a component - so static-components is a false positive here (same as `CardRenderer`).
   const Icon = iconForTarget(target);
   return (
      <a
         href={href}
         className={cn('pointer-events-auto cursor-pointer', INTERNAL_LINK_CHIP)}
         onPointerDown={(event) => event.stopPropagation()}
         onClick={(event) => {
            event.preventDefault();
            onActivate?.(href);
         }}
      >
         {/* eslint-disable-next-line react-hooks/static-components */}
         <Icon className={INTERNAL_LINK_ICON} aria-hidden />
         <span>{children}</span>
      </a>
   );
}
