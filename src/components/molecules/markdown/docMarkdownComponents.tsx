// -- Utils Imports --
import { cn } from '@/lib/utils';

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
 * Mentions are supplied separately (the shared `mentionComponents`), unchanged. Inline images
 * still strip to alt text for now; the Note-specific `asset:` image renderer arrives in a later
 * phase - do not loosen this to auto-load remote images.
 */

export const docMarkdownComponents: Components = {
   h1: ({ ...props }) => <h1 className="mb-3 mt-6 text-3xl font-bold first:mt-0" {...props} />,
   h2: ({ ...props }) => <h2 className="mb-2 mt-6 text-2xl font-bold first:mt-0" {...props} />,
   h3: ({ ...props }) => <h3 className="mb-2 mt-5 text-xl font-semibold first:mt-0" {...props} />,
   h4: ({ ...props }) => <h4 className="mb-1.5 mt-4 text-lg font-semibold first:mt-0" {...props} />,
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
   blockquote: ({ ...props }) => <blockquote className="my-4 border-l-4 border-current/30 pl-4 italic opacity-90" {...props} />,
   hr: ({ ...props }) => <hr className="my-6 border-current/20" {...props} />,
   table: ({ ...props }) => (
      <div className="my-4 overflow-x-auto">
         <table className="w-full border-collapse text-[0.95em]" {...props} />
      </div>
   ),
   th: ({ ...props }) => <th className="border border-current/30 px-2.5 py-1.5 text-left font-semibold" {...props} />,
   td: ({ ...props }) => <td className="border border-current/30 px-2.5 py-1.5" {...props} />,
   // Never auto-load a remote image (untrusted content); show its alt text instead. The Note-specific
   // `asset:` renderer (inline images) lands in a later phase.
   img: ({ alt }) => (alt ? <span className="opacity-70">{alt}</span> : null),
};
