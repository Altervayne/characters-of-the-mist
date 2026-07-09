import { describe, it, expect } from 'vitest';

import { remarkSoftBreaks } from './remarkSoftBreaks';

/*
 * A single newline inside a paragraph must become a hard break (so Reading matches Live line-for-line). These
 * pin the split: interior `\n` -> `break` nodes, non-text leaves (code) untouched, recursion into children.
 */

interface MdNode { type: string; value?: string; children?: MdNode[] }

function transform(tree: MdNode): MdNode {
   remarkSoftBreaks()(tree);
   return tree;
}

describe('remarkSoftBreaks', () => {
   it('splits a text node\'s interior newline into a break', () => {
      const tree = transform({ type: 'root', children: [
         { type: 'paragraph', children: [{ type: 'text', value: 'a\nb' }] },
      ] });
      const para = tree.children![0];
      expect(para.children!.map((c) => c.type)).toEqual(['text', 'break', 'text']);
      expect(para.children!.map((c) => c.value)).toEqual(['a', undefined, 'b']);
   });

   it('inserts a break per newline for three lines', () => {
      const tree = transform({ type: 'root', children: [
         { type: 'paragraph', children: [{ type: 'text', value: 'one\ntwo\nthree' }] },
      ] });
      expect(tree.children![0].children!.map((c) => c.type)).toEqual(['text', 'break', 'text', 'break', 'text']);
   });

   it('leaves a text node without a newline untouched', () => {
      const tree = transform({ type: 'root', children: [
         { type: 'paragraph', children: [{ type: 'text', value: 'no break here' }] },
      ] });
      expect(tree.children![0].children).toEqual([{ type: 'text', value: 'no break here' }]);
   });

   it('does not touch a code node (a leaf, not a text node)', () => {
      const tree = transform({ type: 'root', children: [
         { type: 'code', value: 'let x = 1\nlet y = 2' },
      ] });
      expect(tree.children![0]).toEqual({ type: 'code', value: 'let x = 1\nlet y = 2' });
   });

   it('recurses into nested children (e.g. a blockquote paragraph)', () => {
      const tree = transform({ type: 'root', children: [
         { type: 'blockquote', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'q1\nq2' }] }] },
      ] });
      expect(tree.children![0].children![0].children!.map((c) => c.type)).toEqual(['text', 'break', 'text']);
   });
});
