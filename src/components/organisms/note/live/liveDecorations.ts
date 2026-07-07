// -- CodeMirror Imports --
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import type { Range } from '@codemirror/state';

// -- Local Imports --
import { parseMentions } from '@/lib/challenge/parseMentions';
import { STATUS_PILL, TAG_PILL } from '@/components/molecules/markdown/MentionPill';
import { MentionPillWidget } from './mentionPillWidget';

/*
 * The Live-Preview INLINE decoration engine (a ViewPlugin). It drives decorations off the Lezer markdown
 * syntax tree - NOT regex - so nesting, escapes, and code fences are correct. Two jobs:
 *
 *  1. HIDE SYNTAX MARKERS as ZERO-WIDTH replaces (`**`, `*`, `` ` ``, `#`, `>`, `-`, link/url brackets), so
 *     a hidden marker takes NO space and NO cursor position - the caret steps cleanly over it (the "phantom
 *     gap" + untrustworthy-cursor fix). Reveal is PER LINE, Obsidian-style: on the line(s) the caret is on,
 *     markers are left raw (real width, editable); everywhere else they collapse. The styled TEXT (bold/
 *     italic/…) is always rendered via a mark class - that is the "live" in Live Preview.
 *  2. `{mention}` -> pill widget (off its own line), revealing the raw `{...}` when the caret is on that line.
 *     Same class-strings as the react-markdown `MentionPill`, so Live == Reading.
 *
 * Both the mention pills here and the block image widgets (StateField, see `imageWidgetField.ts`) are made
 * ATOMIC (`EditorView.atomicRanges`) so the caret never lands INSIDE a widget - it hops over the whole token.
 *
 * NOTE: this is a deliberate reversal of the earlier "opacity not collapse" call - collapse is what makes the
 * cursor honest and matches Obsidian; the small reflow when the caret enters a marked line is the accepted trade.
 */

// Inline mark classes (parity with docMarkdownComponents: strong=bold, em=italic, del=line-through, code chip).
const strongMark = Decoration.mark({ class: 'cm-md-strong' });
const emphasisMark = Decoration.mark({ class: 'cm-md-em' });
const strikeMark = Decoration.mark({ class: 'cm-md-strike' });
const codeMark = Decoration.mark({ class: 'cm-md-code' });
const quoteMark = Decoration.mark({ class: 'cm-md-quote' });
// Heading line classes by level (font size + weight, matching the doc map's h1..h4).
const HEADING_LINE = ['cm-md-h1', 'cm-md-h2', 'cm-md-h3', 'cm-md-h4', 'cm-md-h4', 'cm-md-h4'];
// A hidden syntax marker: a ZERO-WIDTH replace (no layout width, no cursor slot, atomic on caret motion).
const hiddenMark = Decoration.replace({});

/** Lezer node names whose whole span is a syntax marker we collapse off-line / reveal on-line. */
const MARKER_NODES = new Set(['HeaderMark', 'EmphasisMark', 'StrongEmphasisMark', 'CodeMark', 'QuoteMark', 'StrikethroughMark', 'LinkMark', 'URL', 'ListMark']);

/**
 * BLOCK-PREFIX markers (`# `, `> `, `- `, `1. `) sit at line start and are followed by a delimiter SPACE
 * that Lezer tokenizes SEPATELY from the mark. Hiding only the mark leaves that space as a visible left
 * indent, so for these we collapse the mark AND its trailing whitespace, and content sits truly flush.
 * Inline marks (`**`/`*`/`` ` ``) carry no trailing space and collapse to their own span only.
 */
const BLOCK_PREFIX_MARKS = new Set(['HeaderMark', 'QuoteMark', 'ListMark']);

/** Content nodes -> the mark styling their text always carries. */
const CONTENT_MARK: Record<string, Decoration> = {
   StrongEmphasis: strongMark,
   Emphasis: emphasisMark,
   Strikethrough: strikeMark,
   InlineCode: codeMark,
};

/**
 * For a block-prefix mark ending at `markEnd`, returns the offset past its trailing whitespace on `line`
 * (the delimiter space after `#`/`>`/`-`/`1.`), so collapsing `[markFrom, prefixEnd)` hides mark + space and
 * the content aligns flush. Stops at the first non-space char (or line end) - never eats content.
 */
function prefixEnd(line: { from: number; text: string }, markEnd: number): number {
   let end = markEnd;
   const lineEnd = line.from + line.text.length;
   while (end < lineEnd && (line.text[end - line.from] === ' ' || line.text[end - line.from] === '\t')) end++;
   return end;
}

/** The set of line numbers any selection range touches - those lines stay RAW (markers revealed). */
function cursorLines(view: EditorView): Set<number> {
   const lines = new Set<number>();
   const { doc } = view.state;
   for (const range of view.state.selection.ranges) {
      const first = doc.lineAt(range.from).number;
      const last = doc.lineAt(range.to).number;
      for (let n = first; n <= last; n++) lines.add(n);
   }
   return lines;
}

/**
 * Builds two decoration sets: `all` (marks + collapsed markers + pills, the rendered result) and `atomic`
 * (only the zero-width markers + pill widgets). Only the atomic set is fed to `EditorView.atomicRanges` -
 * making the STYLING marks (bold/italic text) atomic would trap the caret out of formatted words.
 */
function buildDecorations(view: EditorView): { all: DecorationSet; atomic: DecorationSet } {
   const ranges: Range<Decoration>[] = [];
   const atomicRanges: Range<Decoration>[] = [];
   const tree = syntaxTree(view.state);
   const { doc } = view.state;
   const activeLines = cursorLines(view);

   // Only decorate the visible viewport (cheap on a long note).
   for (const { from: vFrom, to: vTo } of view.visibleRanges) {
      tree.iterate({
         from: vFrom,
         to: vTo,
         enter: (node) => {
            const name = node.name;

            // Heading LINE class (whole line takes the size), driven by the ATXHeading level.
            const headingMatch = /^ATXHeading(\d)$/.exec(name);
            if (headingMatch) {
               const line = doc.lineAt(node.from);
               ranges.push(Decoration.line({ class: HEADING_LINE[Number(headingMatch[1]) - 1] }).range(line.from));
               return;
            }

            // Content text always carries its mark styling (bold/italic/strike/code). NOT atomic - the caret
            // must move through formatted text normally.
            const contentDeco = CONTENT_MARK[name];
            if (contentDeco && node.to > node.from) {
               ranges.push(contentDeco.range(node.from, node.to));
               return;
            }

            // A blockquote's text is italic-dim (parity with the doc map's blockquote).
            if (name === 'Blockquote') {
               ranges.push(quoteMark.range(node.from, node.to));
               return;
            }

            // Syntax markers: collapsed (zero-width, ATOMIC) unless the caret is on this marker's LINE, where
            // it stays raw so it can be edited. A BLOCK-PREFIX marker also swallows its trailing space so the
            // content sits flush (else the lone delimiter space reads as a left indent).
            if (MARKER_NODES.has(name) && node.to > node.from) {
               if (activeLines.has(doc.lineAt(node.from).number)) return; // caret on this line: leave it raw
               const to = BLOCK_PREFIX_MARKS.has(name) ? prefixEnd(doc.lineAt(node.from), node.to) : node.to;
               const collapsed = hiddenMark.range(node.from, to);
               ranges.push(collapsed);
               atomicRanges.push(collapsed);
            }
         },
      });
   }

   // Mentions are not markdown nodes - scan the visible text and replace `{...}` with a pill (off its line).
   collectMentionRanges(view, ranges, atomicRanges, activeLines);

   // Decoration.set requires sorted; `true` sorts (and orders line vs mark) for us.
   return { all: Decoration.set(ranges, true), atomic: Decoration.set(atomicRanges, true) };
}

/** Adds `{mention}` pill widgets (off the caret's line) / leaves the raw `{...}` when the caret is on that line. */
function collectMentionRanges(view: EditorView, ranges: Range<Decoration>[], atomicRanges: Range<Decoration>[], activeLines: Set<number>): void {
   const { doc } = view.state;
   for (const { from: vFrom, to: vTo } of view.visibleRanges) {
      const text = doc.sliceString(vFrom, vTo);
      let offset = 0;
      for (const segment of parseMentions(text)) {
         if (segment.type === 'text') {
            offset += segment.text.length;
            continue;
         }
         // The raw token is `{raw}` - length is raw + the two braces.
         const from = vFrom + offset;
         const to = from + segment.raw.length + 2;
         offset += segment.raw.length + 2;
         if (activeLines.has(doc.lineAt(from).number)) continue; // caret on this line: leave the raw `{...}` editable
         const pill = Decoration.replace({ widget: new MentionPillWidget(segment, STATUS_PILL, TAG_PILL) }).range(from, to);
         ranges.push(pill);
         atomicRanges.push(pill); // the caret hops over a pill, never into its `{...}`
      }
   }
}

/*
 * The inline Live-Preview decorations, rebuilt on doc/selection/viewport change. It holds both the rendered
 * set and an ATOMIC set (only the collapsed markers + pills), so the caret hops over a collapsed marker /
 * mention pill rather than landing inside it, while still moving normally through bold/italic text.
 */
export const liveInlineDecorations = ViewPlugin.fromClass(
   class {
      decorations: DecorationSet;
      atomic: DecorationSet;
      constructor(view: EditorView) {
         const built = buildDecorations(view);
         this.decorations = built.all;
         this.atomic = built.atomic;
      }
      update(update: ViewUpdate) {
         if (update.docChanged || update.selectionSet || update.viewportChanged) {
            const built = buildDecorations(update.view);
            this.decorations = built.all;
            this.atomic = built.atomic;
         }
      }
   },
   {
      decorations: (plugin) => plugin.decorations,
      provide: (plugin) => EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomic ?? Decoration.none),
   },
);
