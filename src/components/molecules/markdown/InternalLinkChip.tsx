// -- React Imports --
import { useEffect, useState } from 'react';
import { Hash, Link2, Link2Off } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { getItemTypeIconComponent } from '@/lib/utils/drawer-icons';

// -- Portals Imports --
import {
   chooseLinkIcon,
   getCachedLinkMetadata,
   loadLinkMetadata,
   resolveLocalLinkMetadata,
   subscribeLinkMetadata,
} from '@/lib/portals/linkMetadata';

// -- Type Imports --
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { LinkTarget } from '@/lib/portals/linkTarget';
import type { LinkIconChoice, LinkMetadata } from '@/lib/portals/linkMetadata';
import type { NoteHeading } from '@/lib/notes/noteOutline';

/*
 * The internal-link CHIP: a quiet inline pill for a note-body link that points somewhere inside the app
 * (a section, an entity tab, or a tabless element). The class-strings are EXPORTED so the CM6 live-editor
 * widget renders a byte-identical chip (Live == Reading), the same single-source trick the mention pill uses.
 *
 * Unlike a mention pill it carries NO saturated fill (the note body is paper, not chrome) - a `currentColor`
 * tint + a leading per-type icon is the whole affordance, so it never fights the parchment the way a
 * `--primary` fill would. External links are NOT chips: they stay the plain underlined link.
 *
 * The chip resolves its target's metadata (liveness + name + element type) to render three things: a DEAD
 * chip on a confirmed-missing target, the target's resolved NAME for an empty-label link, and an element's
 * REAL type icon. An unresolved target renders in the normal live state (never a false dead flash).
 */

/** The chip container classes, shared with the live widget so the two render paths cannot drift. */
export const INTERNAL_LINK_CHIP = 'inline-flex items-center gap-1 rounded bg-current/8 px-1 py-0.5 align-middle font-medium no-underline transition-colors hover:bg-current/15';
/** The leading icon sizing, shared with the live widget. */
export const INTERNAL_LINK_ICON = 'inline-block h-[0.95em] w-[0.95em] shrink-0 opacity-80';
/** Added to the chip CONTAINER when the target is a confirmed miss - dimmed. Shared with the live widget. */
export const INTERNAL_LINK_CHIP_DEAD = 'opacity-60';
/** Added to the chip TEXT when the target is a confirmed miss - a dotted strike. Shared with the live widget. */
export const INTERNAL_LINK_TEXT_DEAD = 'line-through decoration-dotted';

/** The lucide icon component for a shared {@link LinkIconChoice} - the Reading half of the single-sourced choice. */
export function iconForChoice(choice: LinkIconChoice): LucideIcon {
   switch (choice.kind) {
      case 'section':
         return Hash;
      case 'dead':
         return Link2Off;
      case 'itemType':
         return getItemTypeIconComponent(choice.itemType);
      case 'generic':
         return Link2;
   }
}

/** A fallback chip label for an empty-text link, from the target's own address (used until a name resolves). */
export function linkChipFallbackLabel(target: LinkTarget): string {
   if (target.kind === 'section') return `#${target.slug}`;
   if (target.kind === 'entity') return target.id;
   if (target.kind === 'element') return target.drawerItemId;
   return target.href;
}

/**
 * Resolves a link target's metadata for the chip: a section/external is known synchronously (from the note's
 * `headings`); an entity/element loads from the drawer cache and re-reads on cache changes (a load settling, a
 * rename/delete). Returns `undefined` while a drawer lookup is UNKNOWN, so the chip renders live, never dead.
 */
function useLinkMetadata(target: LinkTarget, headings: NoteHeading[]): LinkMetadata | undefined {
   const local = resolveLocalLinkMetadata(target, headings);
   const key = target.kind === 'entity' ? `entity:${target.entity}:${target.id}` : target.kind === 'element' ? `element:${target.drawerItemId}` : '';
   const [cached, setCached] = useState<LinkMetadata | undefined>(() => getCachedLinkMetadata(target));

   useEffect(() => {
      if (local || !key) return; // section/external: resolved locally, no drawer read
      let cancelled = false;
      const sync = () => { if (!cancelled) setCached(getCachedLinkMetadata(target)); };
      sync();
      void loadLinkMetadata(target).then(sync);
      const unsubscribe = subscribeLinkMetadata(sync);
      return () => { cancelled = true; unsubscribe(); };
      // `target` is reconstructed each render from the same href; `key` is its stable identity.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [key, !local]);

   return local ?? cached;
}

/**
 * The Reading-side chip (react-markdown `a` override). Renders the link label behind a per-type icon on the
 * shared tint; a plain click resolves the link (never navigates the anchor) while the pointerdown guard keeps
 * a tap on a draggable surface (a board tile) from starting a drag. An empty label renders the target's
 * resolved name; a confirmed-missing target renders the dead chip with a "target not found" tooltip.
 */
export function InternalLinkChip({ target, href, headings, authorLabel, deadTooltip, onActivate, children }: {
   target: LinkTarget;
   href: string;
   headings: NoteHeading[];
   /** The author's link text (already trimmed); empty means "name it from the target". */
   authorLabel: string;
   /** The localized "target not found" tooltip for a dead chip. */
   deadTooltip: string;
   onActivate?: (href: string) => void;
   children: ReactNode;
}) {
   const metadata = useLinkMetadata(target, headings);
   const dead = metadata?.exists === false;
   // `iconForChoice` returns one of a handful of stable, module-level lucide components - it never constructs a
   // component - so static-components is a false positive here (same as `CardRenderer`).
   const Icon = iconForChoice(chooseLinkIcon(target, metadata));
   return (
      <a
         href={href}
         className={cn('pointer-events-auto cursor-pointer', INTERNAL_LINK_CHIP, dead && INTERNAL_LINK_CHIP_DEAD)}
         title={dead ? deadTooltip : undefined}
         onPointerDown={(event) => event.stopPropagation()}
         onClick={(event) => {
            event.preventDefault();
            onActivate?.(href);
         }}
      >
         {/* eslint-disable-next-line react-hooks/static-components */}
         <Icon className={INTERNAL_LINK_ICON} aria-hidden />
         <span className={cn(dead && INTERNAL_LINK_TEXT_DEAD)}>{authorLabel ? children : metadata?.displayName ?? linkChipFallbackLabel(target)}</span>
      </a>
   );
}
