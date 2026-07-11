// -- React Imports --
import { isValidElement, useContext } from 'react';

// -- Local Imports --
import { HeadingSlugContext } from './headingSlugContext';

// -- Type Imports --
import type { ReactNode } from 'react';

/*
 * The shared document heading (h1..h6) for the Note markdown renderers. In the note READING context it carries
 * `id={slug}` (from {@link HeadingSlugContext}) so the outline can jump to it and `#slug` links resolve;
 * elsewhere (board embeds / drawer previews) it renders id-less. The id is matched by the heading's SOURCE
 * OFFSET (from the mdast node) against `extractHeadings`, falling back to slugifying its plain text.
 */

/** Per-level heading classes (h1/h2 underlined like the setext identity; h5/h6 step down to body/label size). */
const HEADING_CLASS: Record<number, string> = {
   1: 'clear-both mb-3 mt-6 border-b border-paper-border pb-1 text-3xl font-bold first:mt-0',
   2: 'clear-both mb-2 mt-6 border-b border-paper-border pb-1 text-2xl font-bold first:mt-0',
   3: 'clear-both mb-2 mt-5 text-xl font-semibold first:mt-0',
   4: 'clear-both mb-1.5 mt-4 text-lg font-semibold first:mt-0',
   5: 'clear-both mb-1 mt-4 text-base font-semibold first:mt-0',
   6: 'clear-both mb-1 mt-4 text-sm font-semibold uppercase tracking-wide opacity-80 first:mt-0',
};

/** Flattens react-markdown children to their plain text (for the slug fallback / matching), stripping nested nodes. */
function childrenToText(children: ReactNode): string {
   if (children == null || typeof children === 'boolean') return '';
   if (typeof children === 'string' || typeof children === 'number') return String(children);
   if (Array.isArray(children)) return children.map(childrenToText).join('');
   if (isValidElement(children)) return childrenToText((children.props as { children?: ReactNode }).children);
   return '';
}

export function DocHeading({ level, node, children }: { level: number; node?: { position?: { start?: { offset?: number } } }; children?: ReactNode }) {
   const resolve = useContext(HeadingSlugContext);
   const id = resolve?.(node?.position?.start?.offset, childrenToText(children));
   const Tag = `h${level}` as 'h1';
   return <Tag id={id} className={HEADING_CLASS[level]}>{children}</Tag>;
}
