// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Unit Under Test --
import { portalTargetToLinkTarget } from './portalTarget';

describe('portalTargetToLinkTarget', () => {
   it('maps an entity target through unchanged (same id kind)', () => {
      expect(portalTargetToLinkTarget({ kind: 'entity', entity: 'board', id: 'brd9' })).toEqual({ kind: 'entity', entity: 'board', id: 'brd9' });
      expect(portalTargetToLinkTarget({ kind: 'entity', entity: 'note', id: 'n1' })).toEqual({ kind: 'entity', entity: 'note', id: 'n1' });
      expect(portalTargetToLinkTarget({ kind: 'entity', entity: 'character', id: 'c1' })).toEqual({ kind: 'entity', entity: 'character', id: 'c1' });
   });

   it('maps an element target to the drawer-item link target', () => {
      expect(portalTargetToLinkTarget({ kind: 'element', drawerItemId: 'drw5' })).toEqual({ kind: 'element', drawerItemId: 'drw5' });
   });

   it('maps an external target to the external link target', () => {
      expect(portalTargetToLinkTarget({ kind: 'external', href: 'https://x.y' })).toEqual({ kind: 'external', href: 'https://x.y' });
   });

   it('returns null for a board-element target (no 1a activation)', () => {
      expect(portalTargetToLinkTarget({ kind: 'board-element', boardItemId: 'itm3' })).toBeNull();
   });
});
