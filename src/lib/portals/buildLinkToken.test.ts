// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Units Under Test --
import { buildLinkHref, buildLinkMarkdown, detectExternalUrl, entityForItemType } from './buildLinkToken';
import { parseLinkHref } from './linkTarget';

describe('entityForItemType', () => {
   it('maps the three tab-owning types to their entity kind', () => {
      expect(entityForItemType('NOTE')).toBe('note');
      expect(entityForItemType('FULL_BOARD')).toBe('board');
      expect(entityForItemType('FULL_CHARACTER_SHEET')).toBe('character');
   });

   it('returns null for tabless elements (addressed by drawer item id)', () => {
      expect(entityForItemType('CHALLENGE_CARD')).toBeNull();
      expect(entityForItemType('STATUS_TRACKER')).toBeNull();
      expect(entityForItemType('POST_IT')).toBeNull();
      expect(entityForItemType('IMAGE_CARD')).toBeNull();
   });
});

describe('buildLinkHref + parseLinkHref round-trip', () => {
   it('section', () => {
      const href = buildLinkHref({ kind: 'section', slug: 'the-details' });
      expect(href).toBe('#the-details');
      expect(parseLinkHref(href)).toEqual({ kind: 'section', slug: 'the-details' });
   });

   it('each entity carries its entity id and reads back as that entity', () => {
      for (const entity of ['note', 'board', 'character'] as const) {
         const href = buildLinkHref({ kind: 'entity', entity, id: 'ent123' });
         expect(href).toBe(`cotm://${entity}/ent123`);
         expect(parseLinkHref(href)).toEqual({ kind: 'entity', entity, id: 'ent123' });
      }
   });

   it('element carries the drawer item id under the item scheme', () => {
      const href = buildLinkHref({ kind: 'element', drawerItemId: 'drw9' });
      expect(href).toBe('cotm://item/drw9');
      expect(parseLinkHref(href)).toEqual({ kind: 'element', drawerItemId: 'drw9' });
   });

   it('external passes the url through', () => {
      const href = buildLinkHref({ kind: 'external', url: 'https://example.com/x' });
      expect(href).toBe('https://example.com/x');
      expect(parseLinkHref(href)).toEqual({ kind: 'external', href: 'https://example.com/x' });
   });
});

describe('buildLinkMarkdown', () => {
   it('wraps label + href and escapes a closing bracket in the label', () => {
      expect(buildLinkMarkdown('See details', { kind: 'section', slug: 's' })).toBe('[See details](#s)');
      expect(buildLinkMarkdown('a] b', { kind: 'external', url: 'https://x.y' })).toBe('[a\\] b](https://x.y)');
   });
});

describe('detectExternalUrl', () => {
   it('passes an explicit http(s) scheme through', () => {
      expect(detectExternalUrl('https://example.com')).toBe('https://example.com');
      expect(detectExternalUrl('http://a.b/c?d=1')).toBe('http://a.b/c?d=1');
   });

   it('prefixes https:// onto a bare domain.tld shape', () => {
      expect(detectExternalUrl('example.com')).toBe('https://example.com');
      expect(detectExternalUrl('sub.example.co.uk/path')).toBe('https://sub.example.co.uk/path');
   });

   it('rejects plain search terms (no dotted host, or whitespace)', () => {
      expect(detectExternalUrl('the baron')).toBeNull();
      expect(detectExternalUrl('notes')).toBeNull();
      expect(detectExternalUrl('a b.com')).toBeNull();
      expect(detectExternalUrl('')).toBeNull();
   });
});
