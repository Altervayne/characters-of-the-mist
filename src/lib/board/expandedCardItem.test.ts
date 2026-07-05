import { describe, it, expect } from 'vitest';

import { isExpandedCardItem } from './expandedCardItem';
import type { BoardItem } from '@/lib/types/board';
import type { Card } from '@/lib/types/character';

/** A minimal card-copy board item wrapping `card` in its `content.data`. */
function cardItem(card: Partial<Card> | null, mode: 'copy' | 'reference' = 'copy'): BoardItem {
   const content =
      mode === 'copy'
         ? { kind: 'card' as const, mode: 'copy' as const, data: card }
         : { kind: 'card' as const, mode: 'reference' as const, sourceDrawerItemId: 's1' };
   return { id: 'i1', kind: 'card', x: 0, y: 0, width: 250, height: 600, z: 0, content };
}

describe('isExpandedCardItem', () => {
   it('is true for a card copy with expanded set', () => {
      expect(isExpandedCardItem(cardItem({ expanded: true }))).toBe(true);
   });

   it('is false for a card copy without expanded (existing boards default to card mode)', () => {
      expect(isExpandedCardItem(cardItem({}))).toBe(false);
      expect(isExpandedCardItem(cardItem({ expanded: false }))).toBe(false);
   });

   it('is false for a reference (only a copy can be expanded)', () => {
      expect(isExpandedCardItem(cardItem(null, 'reference'))).toBe(false);
   });

   it('is false for a non-card item', () => {
      const postIt: BoardItem = { id: 'p1', kind: 'post-it', x: 0, y: 0, width: 180, height: 180, z: 0, content: { kind: 'post-it', mode: 'copy', data: { id: 'n1', text: '' } } };
      expect(isExpandedCardItem(postIt)).toBe(false);
   });
});
