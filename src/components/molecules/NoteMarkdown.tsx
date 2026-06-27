// -- Library Imports --
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// -- Utils Imports --
import { cn } from '@/lib/utils';

/*
 * A Markdown renderer for board NOTES (post-its, journal pages). Unlike the patch-notes MarkdownContent, it
 * INHERITS its text color (a post-it's color is derived from its background, so a fixed token would make a
 * dark note unreadable) - every accent (code tint, blockquote border, hr) is a translucent `currentColor`,
 * never a theme token. Spacing is tight for a small note, not an article.
 *
 * Safe by default for imported (untrusted) boards: no `rehype-raw` (embedded HTML / scripts never render),
 * react-markdown's default URL sanitizing is kept, images render their alt text only (so a note can't
 * phone home on display), and links open in a new tab. The whole block is pointer-transparent so a click
 * falls through to select the note - only links keep pointer events, so they open instead of selecting.
 */

export function NoteMarkdown({ content, className }: { content: string; className?: string }) {
   return (
      <div className={cn('pointer-events-none text-sm leading-snug break-words', className)}>
         <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
               h1: ({ ...props }) => <h1 className="mb-1 mt-2 text-lg font-bold first:mt-0" {...props} />,
               h2: ({ ...props }) => <h2 className="mb-1 mt-2 text-base font-bold first:mt-0" {...props} />,
               h3: ({ ...props }) => <h3 className="mb-0.5 mt-1.5 text-sm font-bold first:mt-0" {...props} />,
               p: ({ ...props }) => <p className="my-1 first:mt-0 last:mb-0" {...props} />,
               strong: ({ ...props }) => <strong className="font-bold" {...props} />,
               em: ({ ...props }) => <em className="italic" {...props} />,
               del: ({ ...props }) => <del className="line-through opacity-80" {...props} />,
               // Anchors keep pointer events (and swallow the pointerdown) so a click opens the link
               // instead of falling through to select the note; everything else selects.
               a: ({ ...props }) => <a className="pointer-events-auto underline" target="_blank" rel="noopener noreferrer" onPointerDown={(event) => event.stopPropagation()} {...props} />,
               ul: ({ ...props }) => <ul className="my-1 list-disc pl-5" {...props} />,
               ol: ({ ...props }) => <ol className="my-1 list-decimal pl-5" {...props} />,
               li: ({ className: liClass, ...props }) => <li className={cn('my-0.5', liClass?.includes('task-list-item') && 'list-none -ml-5')} {...props} />,
               // GFM task-list checkboxes: kept disabled (display only), tinted with the inherited color.
               input: ({ ...props }) => <input {...props} disabled className="mr-1 align-middle" style={{ accentColor: 'currentColor' }} />,
               code: ({ ...props }) => <code className="rounded bg-current/10 px-1 py-0.5 font-mono text-[0.85em]" {...props} />,
               // Code block: one tinted, horizontally-scrolling box; reset the inner code's own inline tint.
               pre: ({ ...props }) => <pre className="my-1 overflow-x-auto rounded bg-current/10 p-2 font-mono text-[0.85em] [&>code]:bg-transparent [&>code]:p-0" {...props} />,
               blockquote: ({ ...props }) => <blockquote className="my-1 border-l-2 border-current/40 pl-2 opacity-90" {...props} />,
               hr: ({ ...props }) => <hr className="my-2 border-current/20" {...props} />,
               table: ({ ...props }) => (
                  <div className="my-1 overflow-x-auto">
                     <table className="w-full border-collapse text-[0.85em]" {...props} />
                  </div>
               ),
               th: ({ ...props }) => <th className="border border-current/30 px-1.5 py-0.5 text-left font-semibold" {...props} />,
               td: ({ ...props }) => <td className="border border-current/30 px-1.5 py-0.5" {...props} />,
               // Never auto-load a remote image (untrusted boards); show its alt text instead.
               img: ({ alt }) => (alt ? <span className="opacity-70">{alt}</span> : null),
            }}
         >
            {content}
         </ReactMarkdown>
      </div>
   );
}
