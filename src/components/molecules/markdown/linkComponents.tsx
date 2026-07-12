// -- React Imports --
import { isValidElement } from 'react';

// -- Portals Imports --
import { parseLinkHref } from '@/lib/portals/linkTarget';

// -- Local Imports --
import { InternalLinkChip, linkChipFallbackLabel } from './InternalLinkChip';

// -- Type Imports --
import type { ReactNode } from 'react';
import type { Components } from 'react-markdown';

/*
 * The note-reading `a` override. It sniffs the href scheme: an INTERNAL link (a same-note section, an entity
 * tab, or a tabless element) renders as an {@link InternalLinkChip} and resolves via `onLinkActivate` (never
 * navigating the anchor); an EXTERNAL / unrecognised link stays the plain underlined new-tab link. Supplied to
 * `NoteDocument` alongside the image + mention overrides, so it only reshapes links in the note surface - the
 * shared `docMarkdownComponents.a` stays the external-only default for any other consumer.
 *
 * Note the `cotm://` href only survives to here because `noteUrlTransform` passes the scheme through the
 * sanitizer; without that the anchor renders with an empty href and never classifies.
 */

/** Flattens react-markdown children to plain text, for the empty-label fallback. */
function childrenToText(children: ReactNode): string {
   if (children == null || typeof children === 'boolean') return '';
   if (typeof children === 'string' || typeof children === 'number') return String(children);
   if (Array.isArray(children)) return children.map(childrenToText).join('');
   if (isValidElement(children)) return childrenToText((children.props as { children?: ReactNode }).children);
   return '';
}

/** The `a` override for the note reading renderer. `onLinkActivate` runs an internal link; omit it for display-only. */
export function linkComponents(onLinkActivate?: (href: string) => void): Components {
   return {
      a: ({ href, children }) => {
         const raw = href ?? '';
         const target = parseLinkHref(raw);
         if (target.kind === 'external' || target.kind === 'unknown') {
            return (
               <a className="pointer-events-auto underline underline-offset-2" href={raw} target="_blank" rel="noopener noreferrer">
                  {children}
               </a>
            );
         }
         const label = childrenToText(children).trim() || linkChipFallbackLabel(target);
         return (
            <InternalLinkChip target={target} href={raw} onActivate={onLinkActivate}>
               {label}
            </InternalLinkChip>
         );
      },
   };
}
