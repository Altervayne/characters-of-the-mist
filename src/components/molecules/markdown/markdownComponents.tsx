// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { MentionPill } from './MentionPill';

// -- Type Imports --
import type { Components } from 'react-markdown';
import type { MentionSegment } from '@/lib/challenge/parseMentions';

/*
 * The shared Markdown renderer pieces. `proseMarkdownComponents` styles standard elements with translucent
 * `currentColor` accents (no theme token) so the same map reads correctly on any background - a colored
 * post-it, a journal page, or card paper. `mentionComponents` renders the `mention` element emitted by
 * `remarkMentions` as a pill; pass the surface's click handler to make the pills materialize a tracker.
 */

export const proseMarkdownComponents: Components = {
   h1: ({ ...props }) => <h1 className="mb-1 mt-2 text-lg font-bold first:mt-0" {...props} />,
   h2: ({ ...props }) => <h2 className="mb-1 mt-2 text-base font-bold first:mt-0" {...props} />,
   h3: ({ ...props }) => <h3 className="mb-0.5 mt-1.5 text-sm font-bold first:mt-0" {...props} />,
   p: ({ ...props }) => <p className="my-1 first:mt-0 last:mb-0" {...props} />,
   strong: ({ ...props }) => <strong className="font-bold" {...props} />,
   em: ({ ...props }) => <em className="italic" {...props} />,
   del: ({ ...props }) => <del className="line-through opacity-80" {...props} />,
   // Anchors keep pointer events (and swallow the pointerdown) so a click opens the link instead of falling
   // through to select/drag the surface; everything else stays pointer-transparent to its host.
   a: ({ ...props }) => <a className="pointer-events-auto underline" target="_blank" rel="noopener noreferrer" onPointerDown={(event) => event.stopPropagation()} {...props} />,
   ul: ({ ...props }) => <ul className="my-1 list-disc pl-5" {...props} />,
   ol: ({ ...props }) => <ol className="my-1 list-decimal pl-5" {...props} />,
   li: ({ className, ...props }) => <li className={cn('my-0.5', className?.includes('task-list-item') && 'list-none -ml-5')} {...props} />,
   input: ({ ...props }) => <input {...props} disabled className="mr-1 align-middle" style={{ accentColor: 'currentColor' }} />,
   code: ({ ...props }) => <code className="rounded bg-current/10 px-1 py-0.5 font-mono text-[0.85em]" {...props} />,
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
};

/** Reads the parsed segment off the `mention` element's properties (set by `remarkMentions`). */
function segmentFromProperties(properties: Record<string, unknown> | undefined): MentionSegment | null {
   const type = properties?.mentionType;
   const name = String(properties?.mentionName ?? '');
   const raw = String(properties?.mentionRaw ?? '');
   if (type === 'status') return { type: 'status', name, tier: Number(properties?.mentionTier ?? 0), raw };
   if (type === 'tag') return { type: 'tag', name, raw };
   return null;
}

/**
 * The `components` entry that renders `remarkMentions`' `mention` element as a pill. `onMentionClick` (when
 * given) makes the pill interactive; the element name is not a standard HTML tag, so the map is cast.
 */
export function mentionComponents(onMentionClick?: (segment: MentionSegment) => void): Components {
   return {
      mention: ({ node }: { node?: { properties?: Record<string, unknown> } }) => {
         const segment = segmentFromProperties(node?.properties);
         if (!segment || segment.type === 'text') return null;
         return <MentionPill segment={segment} onMentionClick={onMentionClick} />;
      },
   } as unknown as Components;
}
