import { describe, it, expect } from 'vitest';

import { remarkLineBreaks } from './remarkLineBreaks';

/*
 * The narrow `<br>` allowance: ONLY a lone `<br>`/`<br/>` html node becomes a semantic `break`; every other
 * raw-HTML node is left untouched (and, without rehype-raw, renders inert as text). These pin that boundary.
 */

interface MdNode { type: string; value?: string; children?: MdNode[] }

/** Runs the plugin over a small tree and returns it. */
function transform(tree: MdNode): MdNode {
   remarkLineBreaks()(tree);
   return tree;
}

describe('remarkLineBreaks', () => {
   it('turns a lone <br> html node into a break', () => {
      const tree = transform({ type: 'root', children: [
         { type: 'paragraph', children: [
            { type: 'text', value: 'Foo' },
            { type: 'html', value: '<br>' },
            { type: 'text', value: 'Bar' },
         ] },
      ] });
      const para = tree.children![0];
      expect(para.children!.map((c) => c.type)).toEqual(['text', 'break', 'text']);
      expect(para.children![1].value).toBeUndefined(); // the raw value is dropped
   });

   it('accepts <br/> and <br /> variants (case-insensitive)', () => {
      for (const raw of ['<br/>', '<br />', '<BR>', '<Br >']) {
         const tree = transform({ type: 'root', children: [{ type: 'html', value: raw }] });
         expect(tree.children![0].type).toBe('break');
      }
   });

   it('leaves any OTHER html node untouched (stays inert)', () => {
      for (const raw of ['<script>alert(1)</script>', '<img src=x>', '<b>bold</b>', '<div>']) {
         const tree = transform({ type: 'root', children: [{ type: 'html', value: raw }] });
         expect(tree.children![0].type).toBe('html');
         expect(tree.children![0].value).toBe(raw);
      }
   });

   it('recurses into nested children (e.g. a table cell)', () => {
      const tree = transform({ type: 'root', children: [
         { type: 'tableCell', children: [{ type: 'html', value: '<br>' }] },
      ] });
      expect(tree.children![0].children![0].type).toBe('break');
   });
});
