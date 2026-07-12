// -- CodeMirror Imports --
import { WidgetType } from '@codemirror/view';

// -- Shared chip styling (single-sourced with the Reading chip) --
import { INTERNAL_LINK_CHIP, INTERNAL_LINK_ICON } from '@/components/molecules/markdown/InternalLinkChip';

// -- Type Imports --
import type { LinkTarget } from '@/lib/portals/linkTarget';

/*
 * The CM6 live-editor widget for an internal-link chip. It renders the SAME class-strings/structure as the
 * react-markdown `InternalLinkChip` (imported single-sourced), so Live == Reading. Pure imperative DOM - no
 * React root per widget - matching the mention-pill widget. The underlying `[text](cotm://…)` doc text is
 * untouched; this only replaces its rendering off the caret's line (the raw markdown reveals on the line).
 *
 * The leading icon mirrors `iconForTarget`'s selection as inline SVG copied from lucide-react (v0.562.0): a
 * section is a hash, an entity its drawer glyph, an element the generic link-2. Kept as raw SVG because a CM6
 * widget must not pull React (the same reason the cover/format/image widgets hand-write their glyphs).
 */

/** The inner SVG paths per icon, copied verbatim from lucide-react v0.562.0 so the widget matches Reading. */
const ICON_INNER: Record<'section' | 'note' | 'board' | 'character' | 'element', string> = {
   section:
      '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
   note:
      '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>',
   board:
      '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
   character:
      '<path d="M16 10h2"/><path d="M16 14h2"/><path d="M6.17 15a3 3 0 0 1 5.66 0"/><circle cx="9" cy="11" r="2"/><rect x="2" y="5" width="20" height="14" rx="2"/>',
   element: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>',
};

/** The icon key for a target, mirroring `iconForTarget` (section / per-entity / generic-element). */
function iconKey(target: LinkTarget): keyof typeof ICON_INNER {
   if (target.kind === 'section') return 'section';
   if (target.kind === 'entity') return target.entity;
   return 'element';
}

export class InternalLinkWidget extends WidgetType {
   private readonly key: keyof typeof ICON_INNER;
   private readonly label: string;

   constructor(target: LinkTarget, label: string) {
      super();
      this.key = iconKey(target);
      this.label = label;
   }

   // Identical chips reuse the DOM (no churn as decorations rebuild).
   eq(other: InternalLinkWidget): boolean {
      return other.key === this.key && other.label === this.label;
   }

   toDOM(): HTMLElement {
      const chip = document.createElement('span');
      chip.className = INTERNAL_LINK_CHIP;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', INTERNAL_LINK_ICON);
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = ICON_INNER[this.key];
      chip.appendChild(svg);

      const text = document.createElement('span');
      text.textContent = this.label;
      chip.appendChild(text);
      return chip;
   }

   // Let a click through so the caret can land on the `[text](…)` to edit it (Live-Preview reveal-on-cursor).
   ignoreEvent(): boolean {
      return false;
   }
}
