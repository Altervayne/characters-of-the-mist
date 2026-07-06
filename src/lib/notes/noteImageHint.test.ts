// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import {
   activeImageTokenAt,
   findImageTokens,
   glueImageToNextParagraph,
   parseImageHint,
   rewriteImageHintAt,
   serializeImageHint,
   setImageAlignAt,
   unglueImageFromParagraph,
} from './noteImageHint';

const HASH = 'a1b2c3d4e5f6';
const HASH2 = 'f6e5d4c3b2a1';

describe('parseImageHint', () => {
   it('defaults a missing/empty/garbage hint to center 100', () => {
      expect(parseImageHint(undefined)).toEqual({ align: 'center', widthPct: 100 });
      expect(parseImageHint('')).toEqual({ align: 'center', widthPct: 100 });
      expect(parseImageHint('   ')).toEqual({ align: 'center', widthPct: 100 });
      expect(parseImageHint('banana')).toEqual({ align: 'center', widthPct: 100 });
   });

   it('parses canonical align + width', () => {
      expect(parseImageHint('left 40')).toEqual({ align: 'left', widthPct: 40 });
      expect(parseImageHint('right 45')).toEqual({ align: 'right', widthPct: 45 });
      expect(parseImageHint('center 50')).toEqual({ align: 'center', widthPct: 50 });
   });

   it('pins full to 100 and ignores any stored width', () => {
      expect(parseImageHint('full')).toEqual({ align: 'full', widthPct: 100 });
      expect(parseImageHint('full 40')).toEqual({ align: 'full', widthPct: 100 });
   });

   it('accepts a trailing % on parse (never emitted)', () => {
      expect(parseImageHint('left 40%')).toEqual({ align: 'left', widthPct: 40 });
   });

   it('expands the shipped size-word aliases to center + bucket', () => {
      expect(parseImageHint('small')).toEqual({ align: 'center', widthPct: 30 });
      expect(parseImageHint('medium')).toEqual({ align: 'center', widthPct: 50 });
   });

   it('defaults a widthless float to its band midpoint and a widthless center to 100', () => {
      expect(parseImageHint('left')).toEqual({ align: 'left', widthPct: 40 });
      expect(parseImageHint('center')).toEqual({ align: 'center', widthPct: 100 });
   });

   it('parses a bare width as a centered block', () => {
      expect(parseImageHint('50')).toEqual({ align: 'center', widthPct: 50 });
   });

   it('clamps width into the align band', () => {
      expect(parseImageHint('left 5')).toEqual({ align: 'left', widthPct: 25 }); // float floor 25
      expect(parseImageHint('left 250')).toEqual({ align: 'left', widthPct: 55 }); // float ceil 55
      expect(parseImageHint('center 5')).toEqual({ align: 'center', widthPct: 30 }); // center floor 30
   });

   it('ignores extra/unknown tokens (forward-compat)', () => {
      expect(parseImageHint('left 40 xyz')).toEqual({ align: 'left', widthPct: 40 });
   });
});

describe('serializeImageHint', () => {
   it('omits the title at the default (center 100)', () => {
      expect(serializeImageHint({ align: 'center', widthPct: 100 })).toBeUndefined();
   });

   it('emits full without a width', () => {
      expect(serializeImageHint({ align: 'full', widthPct: 100 })).toBe('full');
   });

   it('emits bare "align width" (no %) for floats and non-default center', () => {
      expect(serializeImageHint({ align: 'left', widthPct: 40 })).toBe('left 40');
      expect(serializeImageHint({ align: 'center', widthPct: 50 })).toBe('center 50');
   });

   it('round-trips idempotently: parse -> serialize -> parse', () => {
      for (const title of ['left 40', 'right 55', 'center 30', 'full', undefined]) {
         const once = parseImageHint(title);
         const serialized = serializeImageHint(once);
         expect(parseImageHint(serialized)).toEqual(once);
      }
   });
});

describe('findImageTokens', () => {
   it('finds every token in order with span + parts', () => {
      const body = `intro ![a map](asset:${HASH} "left 40") mid ![](asset:${HASH2})`;
      const tokens = findImageTokens(body);
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ hash: HASH, title: 'left 40', alt: 'a map' });
      expect(tokens[1]).toMatchObject({ hash: HASH2, title: '', alt: '' });
      // Spans are exact.
      expect(body.slice(tokens[0].index, tokens[0].index + tokens[0].length)).toBe(`![a map](asset:${HASH} "left 40")`);
   });

   it('keys the same asset used twice by ABSOLUTE OFFSET, never by hash', () => {
      const body = `![](asset:${HASH}) then again ![](asset:${HASH})`;
      const tokens = findImageTokens(body);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].hash).toBe(tokens[1].hash);
      expect(tokens[0].index).not.toBe(tokens[1].index); // distinct rewrite identities
   });
});

describe('activeImageTokenAt', () => {
   it('returns the token whose span contains the caret (inclusive of both ends)', () => {
      const body = `x ![](asset:${HASH}) y`;
      const token = findImageTokens(body)[0];
      expect(activeImageTokenAt(body, token.index)?.hash).toBe(HASH); // at the start
      expect(activeImageTokenAt(body, token.index + token.length)?.hash).toBe(HASH); // at the end
      expect(activeImageTokenAt(body, 0)).toBeNull(); // outside
   });

   it('distinguishes two uses of the same asset by caret position', () => {
      const body = `![](asset:${HASH}) mid ![](asset:${HASH})`;
      const [first, second] = findImageTokens(body);
      expect(activeImageTokenAt(body, first.index + 1)?.index).toBe(first.index);
      expect(activeImageTokenAt(body, second.index + 1)?.index).toBe(second.index);
   });
});

describe('rewriteImageHintAt', () => {
   it('rewrites ONE token, leaving the rest byte-identical', () => {
      const body = `A ![c](asset:${HASH}) B ![d](asset:${HASH2}) C`;
      const target = findImageTokens(body)[0];
      const next = rewriteImageHintAt(body, target.index, { align: 'left', widthPct: 40 });
      expect(next).toBe(`A ![c](asset:${HASH} "left 40") B ![d](asset:${HASH2}) C`);
   });

   it('drops the title when the layout serializes to the default', () => {
      const body = `![c](asset:${HASH} "left 40")`;
      const target = findImageTokens(body)[0];
      expect(rewriteImageHintAt(body, target.index, { align: 'center', widthPct: 100 })).toBe(`![c](asset:${HASH})`);
   });

   it('can also rewrite the alt (caption)', () => {
      const body = `![](asset:${HASH})`;
      expect(rewriteImageHintAt(body, 0, { align: 'center', widthPct: 100 }, 'a caption')).toBe(`![a caption](asset:${HASH})`);
   });

   it('never touches the asset:HASH src (the anti-data-loss guarantee)', () => {
      const body = `![](asset:${HASH} "center 50")`;
      const out = rewriteImageHintAt(body, 0, { align: 'left', widthPct: 55 });
      expect(out).toContain(`asset:${HASH}`);
   });

   it('is a no-op when the offset does not start a token', () => {
      const body = 'no image here';
      expect(rewriteImageHintAt(body, 3, { align: 'left', widthPct: 40 })).toBe(body);
   });
});

describe('auto-glue', () => {
   it('glues a float onto the next paragraph (collapses the blank line to a space)', () => {
      const body = `![](asset:${HASH})\n\nLore wraps beside it.`;
      expect(glueImageToNextParagraph(body, 0)).toBe(`![](asset:${HASH}) Lore wraps beside it.`);
   });

   it('does NOT glue into a heading', () => {
      const body = `![](asset:${HASH})\n\n## A heading`;
      expect(glueImageToNextParagraph(body, 0)).toBe(body);
   });

   it('does NOT glue into a list', () => {
      const body = `![](asset:${HASH})\n\n- item one`;
      expect(glueImageToNextParagraph(body, 0)).toBe(body);
   });

   it('does NOT glue into another image', () => {
      const body = `![](asset:${HASH})\n\n![](asset:${HASH2})`;
      expect(glueImageToNextParagraph(body, 0)).toBe(body);
   });

   it('does NOT glue when nothing follows', () => {
      const body = `![](asset:${HASH})`;
      expect(glueImageToNextParagraph(body, 0)).toBe(body);
      expect(glueImageToNextParagraph(`![](asset:${HASH})\n\n`, 0)).toBe(`![](asset:${HASH})\n\n`);
   });

   it('is idempotent once glued', () => {
      const glued = `![](asset:${HASH}) Lore.`;
      expect(glueImageToNextParagraph(glued, 0)).toBe(glued);
   });

   it('un-glues a same-line float back into its own block', () => {
      const body = `![](asset:${HASH}) Lore wraps beside it.`;
      expect(unglueImageFromParagraph(body, 0)).toBe(`![](asset:${HASH})\n\nLore wraps beside it.`);
   });

   it('un-glue is a no-op when the image already stands alone', () => {
      const body = `![](asset:${HASH})\n\nSeparate paragraph.`;
      expect(unglueImageFromParagraph(body, 0)).toBe(body);
   });

   it('setImageAlignAt glues on float and un-glues on center', () => {
      const block = `![](asset:${HASH})\n\nLore wraps beside it.`;
      const floated = setImageAlignAt(block, 0, 'left', 40);
      expect(floated).toBe(`![](asset:${HASH} "left 40") Lore wraps beside it.`);

      // Switching the floated one back to center un-glues AND drops to the default title.
      const centered = setImageAlignAt(floated, 0, 'center', 100);
      expect(centered).toBe(`![](asset:${HASH})\n\nLore wraps beside it.`);
   });
});
