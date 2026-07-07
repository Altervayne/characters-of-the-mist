// -- CodeMirror Imports --
import { Decoration, EditorView } from '@codemirror/view';
import { StateField } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';

// -- Local Imports --
import { findImageTokens } from '@/lib/notes/noteImageHint';
import { AssetImageWidget } from './assetImageWidget';

/*
 * The Live-Preview IMAGE decorations, sourced from a StateField - NOT a ViewPlugin. CM6 forbids block
 * decorations from a plugin (`RangeError: Block decorations may not be specified via plugins`), and an inline
 * image widget can't host the resize handles + align bar cleanly, so each `![](asset:hash "hint")` token is a
 * BLOCK replace widget from this field. The field also tracks the SELECTED image (the token whose span holds
 * the caret) so its chrome (ring + handles + align bar) shows; a rebuild flips selection as the caret moves.
 *
 * The buffer is untouched - decorations render OVER the literal `![](...)` text; the widget's rewrites go
 * back through `view.dispatch` (see `assetImageWidget.ts`). The field also provides its ranges as ATOMIC,
 * so the caret hops OVER an image token rather than landing inside its `![](...)` markdown.
 */

function buildImageDecorations(state: EditorState): DecorationSet {
   const body = state.doc.toString();
   const head = state.selection.main.head;
   const ranges = findImageTokens(body).map((token) => {
      const selected = head >= token.index && head <= token.index + token.length;
      return Decoration.replace({
         widget: new AssetImageWidget(token.hash, token.alt, token.title, selected),
         block: true,
      }).range(token.index, token.index + token.length);
   });
   return Decoration.set(ranges, true);
}

/** The block image-widget decorations, rebuilt whenever the doc or selection changes. */
export const imageWidgetField = StateField.define<DecorationSet>({
   create: buildImageDecorations,
   update(deco, transaction) {
      if (transaction.docChanged || transaction.selection) return buildImageDecorations(transaction.state);
      return deco.map(transaction.changes);
   },
   provide: (field) => [
      EditorView.decorations.from(field),
      // The image token is atomic: the caret steps over the whole `![](...)`, never into it.
      EditorView.atomicRanges.of((view) => view.state.field(field, false) ?? Decoration.none),
   ],
});
