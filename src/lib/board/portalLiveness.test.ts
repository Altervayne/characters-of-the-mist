// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Unit Under Test --
import { isPortalDead, portalDeadLabel, portalLivenessTarget } from './portalLiveness';

// -- Type Imports --
import type { PortalStyle } from '@/lib/types/board';

const style = (over: Partial<PortalStyle> = {}): PortalStyle => ({ visual: null, label: '', align: 'right', background: true, ...over });

describe('portalLivenessTarget', () => {
   it('follows an entity/element target through the resolver mapping', () => {
      expect(portalLivenessTarget({ kind: 'entity', entity: 'note', id: 'n1' })).toEqual({ kind: 'entity', entity: 'note', id: 'n1' });
      expect(portalLivenessTarget({ kind: 'element', drawerItemId: 'd1' })).toEqual({ kind: 'element', drawerItemId: 'd1' });
   });

   it('excludes an external target (always live, no check)', () => {
      expect(portalLivenessTarget({ kind: 'external', href: 'https://x.y' })).toBeNull();
   });

   it('excludes a board-element target (no v1 resolver mapping, never dead)', () => {
      expect(portalLivenessTarget({ kind: 'board-element', boardItemId: 'i1' })).toBeNull();
   });
});

describe('isPortalDead', () => {
   it('is dead only on a confirmed miss', () => {
      expect(isPortalDead({ exists: false })).toBe(true);
   });

   it('reads live while unknown/loading or confirmed present (no dead flash)', () => {
      expect(isPortalDead(undefined)).toBe(false);
      expect(isPortalDead({ exists: true, displayName: 'The Keep' })).toBe(false);
   });
});

describe('portalDeadLabel', () => {
   it('prefers the author label', () => {
      expect(portalDeadLabel(style({ label: 'To the vault' }), 'The Vault')).toBe('To the vault');
   });

   it('falls back to the cached last-known name for an empty label', () => {
      expect(portalDeadLabel(style({ label: '' }), 'The Vault')).toBe('The Vault');
   });

   it('is empty when neither a label nor a last-known name exists (never an id/blank surprise)', () => {
      expect(portalDeadLabel(style({ label: '' }), undefined)).toBe('');
   });
});
