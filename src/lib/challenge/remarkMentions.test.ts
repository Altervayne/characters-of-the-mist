import { describe, expect, it } from 'vitest';

import { remarkMentions } from './remarkMentions';

/*
 * The remark transform: it expands `{brace}` mentions inside text nodes into `mention` elements (carrying
 * the parsed fields as properties) while leaving plain text and code payloads untouched.
 */

interface MdNode {
   type: string;
   value?: string;
   children?: MdNode[];
   data?: { hName?: string; hProperties?: Record<string, string> };
}

/** Runs the plugin over a tree (mutated in place) and returns it. */
function run(tree: MdNode): MdNode {
   remarkMentions()(tree);
   return tree;
}

describe('remarkMentions', () => {
   it('splits a status mention out of a paragraph text node', () => {
      const tree: MdNode = { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'You are {sickened-2} now' }] }] };
      const para = run(tree).children![0];
      expect(para.children).toEqual([
         { type: 'text', value: 'You are ' },
         {
            type: 'mention',
            data: { hName: 'mention', hProperties: { mentionType: 'status', mentionName: 'sickened', mentionRaw: 'sickened-2', mentionTier: '2' } },
            children: [{ type: 'text', value: 'sickened-2' }],
         },
         { type: 'text', value: ' now' },
      ]);
   });

   it('emits a tag mention with an empty tier property', () => {
      const tree: MdNode = { type: 'root', children: [{ type: 'text', value: '{Concerned}' }] };
      const mention = run(tree).children![0];
      expect(mention.data).toEqual({ hName: 'mention', hProperties: { mentionType: 'tag', mentionName: 'Concerned', mentionRaw: 'Concerned', mentionTier: '' } });
   });

   it('recurses into nested formatting (a mention inside strong)', () => {
      const tree: MdNode = { type: 'root', children: [{ type: 'strong', children: [{ type: 'text', value: '{afraid-1}' }] }] };
      const strong = run(tree).children![0];
      expect(strong.children![0].type).toBe('mention');
   });

   it('leaves a text node with no mention untouched', () => {
      const tree: MdNode = { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'plain words' }] }] };
      expect(run(tree).children![0].children).toEqual([{ type: 'text', value: 'plain words' }]);
   });

   it('does not touch code payloads (inlineCode carries a value, not text children)', () => {
      const tree: MdNode = { type: 'root', children: [{ type: 'inlineCode', value: '{sickened-2}' }] };
      const code = run(tree).children![0];
      expect(code.type).toBe('inlineCode');
      expect(code.value).toBe('{sickened-2}');
   });
});
