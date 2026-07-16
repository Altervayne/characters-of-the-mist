// -- Factory Imports --
import { buildLinkMarkdown } from '@/lib/portals/buildLinkToken';

// -- Local Imports --
import { DEMO_NOTE_ID } from './demoSentinels';

// -- Type Imports --
import type { Note } from '@/lib/types/board';

/*
 * The demo note the Notes tutorial (D4) teaches against: a short GM handout authored so its Live render shows
 * every structure the tour names - two headings, a bold/italic opener, a bulleted list, a blockquote, two
 * `{brace}` mention pills (a status and a tag), and a same-note section link built through the real
 * `buildLinkMarkdown` factory so its grammar can never drift from a hand-written literal. It closes on a
 * `## Your turn` heading with a blank line beneath it - the empty line the type-markdown gate invites the
 * reader to write on. MARKDOWN ONLY: no cover, no image, no drawer/entity reference, so nothing reaches a
 * real store. The assembled template is deep-frozen and a fresh `structuredClone` is handed out per run, so a
 * demo keystroke mutates only the clone and the next run starts clean.
 */

const NOTE_TITLE = "The Warden's Briefing";

/** The same-note link, targeting the Standing Orders heading (slug from `slugifyHeading`). */
const ORDERS_LINK = buildLinkMarkdown('the standing orders', { kind: 'section', slug: 'the-standing-orders' });

/** The handout body: literal markdown, the section link spliced in through the factory. */
const NOTE_BODY = [
   '**The tide is turning.** _The Warden wants the vault sealed before nightfall._',
   '',
   '## The Standing Orders',
   '',
   'The crew answers to three rules, and breaking them is how people vanish down here.',
   '',
   '- Never open the vault door at high tide.',
   '- Keep a lantern lit; the dark itself works as {ancient-ward} against you.',
   '- When the Warden calls, answer before the third bell.',
   '',
   '## The Warden',
   '',
   'She keeps her temper on a short chain, so read every summons as {angry-2} until she proves otherwise. Pleased, she opens doors; crossed, she seals them.',
   '',
   '> The sea remembers every debt, and so does she.',
   '',
   `When in doubt, walk back through ${ORDERS_LINK} before you descend.`,
   '',
   '## Your turn',
   '',
].join('\n');

/** Recursively freezes an object graph so the shared template cannot be mutated in place. */
function deepFreeze<T>(value: T): T {
   if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value as Record<string, unknown>).forEach(deepFreeze);
      Object.freeze(value);
   }
   return value;
}

/** The frozen template, built once. Never handed out directly - clone it. */
const DEMO_NOTE_TEMPLATE = deepFreeze<Note>({ id: DEMO_NOTE_ID, title: NOTE_TITLE, body: NOTE_BODY });

/** A fresh, mutable demo note for one tutorial run (a deep clone of the frozen template). */
export function createDemoNote(): Note {
   return structuredClone(DEMO_NOTE_TEMPLATE);
}
