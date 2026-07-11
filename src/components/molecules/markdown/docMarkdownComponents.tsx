// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Local Imports --
import { DocHeading } from './DocHeading';

// -- Type Imports --
import type { Components } from 'react-markdown';

/*
 * The DOCUMENT Markdown renderer map, for a Note tab surface. A FORK of
 * `proseMarkdownComponents` (the shared card/post-it/journal map) - NOT a widening of it:
 * that map is tuned for a cramped card (`text-sm`, `leading-snug`, `my-1` headings), which
 * reads as a ransom note blown up to full width. A Note is a real document, so this map runs
 * at document scale - `text-base`/`leading-relaxed`, real heading rhythm, generous paragraph
 * air - while keeping the same translucent `currentColor` accents so it inherits the surface's
 * text color. The measure cap (`max-w-[68ch]`, centered) lives on the renderer wrapper, not here.
 *
 * Mentions are supplied separately (the shared `mentionComponents`), unchanged. Inline images are the
 * Note surface's own renderer (wired via `NoteDocument`); this map only strips a bare `img` to alt text.
 * Headings and `hr` carry `clear-both` so a new section starts BELOW a floated image (composes with the
 * float's own `clear-left/right`).
 */

export const docMarkdownComponents: Components = {
   // H1 & H2 carry an UNDERLINE rule on the paper-border token (matching the Live `.cm-md-h1`/`.cm-md-h2`) - a
   // setext heading's identity; Reading can't tell setext from ATX (same mdast), so both underline, GitHub-style.
   // Each heading emits `id={slug}` in the note reading context (via HeadingSlugContext) for outline / #anchor nav.
   h1: (props) => <DocHeading level={1} {...props} />,
   h2: (props) => <DocHeading level={2} {...props} />,
   h3: (props) => <DocHeading level={3} {...props} />,
   h4: (props) => <DocHeading level={4} {...props} />,
   h5: (props) => <DocHeading level={5} {...props} />,
   h6: (props) => <DocHeading level={6} {...props} />,
   p: ({ ...props }) => <p className="my-3 leading-relaxed first:mt-0 last:mb-0" {...props} />,
   strong: ({ ...props }) => <strong className="font-bold" {...props} />,
   em: ({ ...props }) => <em className="italic" {...props} />,
   del: ({ ...props }) => <del className="line-through opacity-80" {...props} />,
   a: ({ ...props }) => <a className="pointer-events-auto underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />,
   ul: ({ ...props }) => <ul className="my-3 list-disc pl-6 leading-relaxed" {...props} />,
   ol: ({ ...props }) => <ol className="my-3 list-decimal pl-6 leading-relaxed" {...props} />,
   li: ({ className, ...props }) => <li className={cn('my-1', className?.includes('task-list-item') && 'list-none -ml-6')} {...props} />,
   input: ({ ...props }) => <input {...props} disabled className="mr-1.5 align-middle" style={{ accentColor: 'currentColor' }} />,
   code: ({ ...props }) => <code className="rounded bg-current/10 px-1.5 py-0.5 font-mono text-[0.9em]" {...props} />,
   pre: ({ ...props }) => <pre className="my-4 overflow-x-auto rounded-md bg-current/10 p-3 font-mono text-[0.9em] [&>code]:bg-transparent [&>code]:p-0" {...props} />,
   // A proper quote BLOCK (callout-like): left accent bar + subtle tint + padding. Matches the Live `.cm-md-quote-line`.
   blockquote: ({ ...props }) => (
      <blockquote className="clear-both my-4 rounded-r border-l-4 border-current/40 bg-current/5 py-2 pl-4 pr-3 italic opacity-90 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" {...props} />
   ),
   hr: ({ ...props }) => <hr className="clear-both my-6 border-t-2 border-current/25" {...props} />,
   // A table always clears the cover float and renders full-width below it (never squished beside the cover). A
   // too-wide table (more columns than fit) scrolls sideways WITHIN this wrapper instead of clipping out of the
   // paper. The per-cell `min-w` mirrors the Live grid's cell min-width so columns keep a legible floor and the
   // table overflows into the scroll (a normal, fitting table stays full-width - the min never binds there).
   table: ({ ...props }) => (
      <div className="clear-both my-4 overflow-x-auto">
         <table className="w-full border-collapse text-[0.95em]" {...props} />
      </div>
   ),
   th: ({ ...props }) => <th className="min-w-[3.25rem] border border-current/30 px-2.5 py-1.5 text-left font-semibold" {...props} />,
   td: ({ ...props }) => <td className="min-w-[3.25rem] border border-current/30 px-2.5 py-1.5" {...props} />,
   // Never auto-load a remote image (untrusted content); show its alt text instead. The Note-specific
   // `asset:` renderer (inline images) lands in a later phase.
   img: ({ alt }) => (alt ? <span className="opacity-70">{alt}</span> : null),
};
