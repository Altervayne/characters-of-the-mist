// -- CodeMirror Imports --
import { WidgetType } from '@codemirror/view';

// -- Type Imports --
import type { MentionSegment } from '@/lib/challenge/parseMentions';

/*
 * The CM6 live-editor widget for a `{brace}` mention pill. It renders the SAME class-strings/structure as the
 * react-markdown `MentionPill` (imported single-sourced), so Live == Reading and the two paths can't drift.
 * Pure imperative DOM - no React root per widget. Non-interactive in the editor (no click-to-mint), matching
 * the plain-span pill variant. The underlying `{...}` doc text is untouched; this only replaces its rendering.
 */

/** The pill segment kinds a widget can render (text segments never become a pill). */
type PillSegment = Extract<MentionSegment, { type: 'status' | 'tag' }>;

export class MentionPillWidget extends WidgetType {
   readonly kind: 'status' | 'tag';
   readonly label: string;
   private readonly className: string;

   constructor(segment: PillSegment, statusClass: string, tagClass: string) {
      super();
      this.kind = segment.type;
      this.label = segment.type === 'status' ? `${segment.name}-${segment.tier}` : segment.name;
      this.className = segment.type === 'status' ? statusClass : tagClass;
   }

   // Identical pills reuse the DOM (no churn as decorations rebuild).
   eq(other: MentionPillWidget): boolean {
      return other.kind === this.kind && other.label === this.label;
   }

   toDOM(): HTMLElement {
      const span = document.createElement('span');
      span.className = this.className;
      span.textContent = this.label;
      return span;
   }

   // Let a click through so the caret can land on the `{...}` to edit it (Live-Preview reveal-on-cursor).
   ignoreEvent(): boolean {
      return false;
   }
}
