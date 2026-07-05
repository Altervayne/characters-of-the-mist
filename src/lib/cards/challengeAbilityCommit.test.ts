import { describe, expect, it } from 'vitest';

import { patchAbilityById, updateRowById } from './challengeCardFactories';
import type { ChallengeAbility } from '@/lib/types/character';

/*
 * Regression: the AbilityEditRow sibling-field clobber. A threat's tag and flavor each ride their own
 * debouncer committing into the ONE shared abilities array; when the accordion row unmounts (the GM
 * switches focus to another threat before the 500ms window elapses) BOTH flush together. The old commit
 * rebuilt the whole ability from a render-time snapshot, so whichever flush ran second wrote a stale copy
 * that overwrote the first field. The fix routes every ability commit through `patchAbilityById` reading
 * the LIVE abilities at commit time, so the second flush already carries the first's write.
 *
 * These tests model the production commit path: a mutable live-store holder plus a `commitAbilityById`
 * built exactly as the card builds it, then fire the two flushes as sequential commits (which is what
 * zustand's synchronous `set` guarantees on the two unmount effects).
 */

const ABILITY_ID = 'a1';

/** A live-store stand-in mirroring the card: `commitAbilityById` reads the current array, patches by id. */
function makeLiveStore(initial: ChallengeAbility[]) {
   let abilities = initial;
   const commitAbilityById = (id: string, mutate: (current: ChallengeAbility) => ChallengeAbility) => {
      abilities = patchAbilityById(abilities, id, mutate);
   };
   return { commitAbilityById, get: () => abilities };
}

function seed(): ChallengeAbility[] {
   return [{ id: ABILITY_ID, tag: '', flavor: '', consequences: [] }];
}

describe('AbilityEditRow commit path (sibling-field clobber regression)', () => {
   it('keeps BOTH tag and flavor when the two debouncers flush together on unmount', () => {
      const store = makeLiveStore(seed());

      // Both closures were built against the SAME render-time ability (tag: '', flavor: ''), exactly as
      // the row's two useInputDebouncer callbacks capture it. The unmount fires them in order.
      const commitTag = () => store.commitAbilityById(ABILITY_ID, (current) => ({ ...current, tag: 'UnmountTag' }));
      const commitFlavor = () => store.commitAbilityById(ABILITY_ID, (current) => ({ ...current, flavor: 'UnmountFlavor' }));

      commitTag();
      commitFlavor();

      expect(store.get()[0]).toMatchObject({ tag: 'UnmountTag', flavor: 'UnmountFlavor' });
   });

   it('survives the flushes firing in the reverse order too', () => {
      const store = makeLiveStore(seed());

      const commitTag = () => store.commitAbilityById(ABILITY_ID, (current) => ({ ...current, tag: 'UnmountTag' }));
      const commitFlavor = () => store.commitAbilityById(ABILITY_ID, (current) => ({ ...current, flavor: 'UnmountFlavor' }));

      commitFlavor();
      commitTag();

      expect(store.get()[0]).toMatchObject({ tag: 'UnmountTag', flavor: 'UnmountFlavor' });
   });

   it('does not clobber the flavor when a consequence edit flushes alongside it', () => {
      const store = makeLiveStore([
         { id: ABILITY_ID, tag: 'Bite', flavor: '', consequences: [{ id: 'c1', text: '' }] },
      ]);

      const commitFlavor = () => store.commitAbilityById(ABILITY_ID, (current) => ({ ...current, flavor: 'Bleeds' }));
      const commitConsequence = () => store.commitAbilityById(ABILITY_ID, (current) => ({
         ...current,
         consequences: updateRowById(current.consequences, 'c1', { text: 'lose a turn' }),
      }));

      commitFlavor();
      commitConsequence();

      expect(store.get()[0]).toMatchObject({
         flavor: 'Bleeds',
         consequences: [{ id: 'c1', text: 'lose a turn' }],
      });
   });

   it('demonstrates the OLD rebuild-from-snapshot path clobbering (the bug this guards against)', () => {
      // The pre-fix commit spread over a captured `ability` snapshot instead of the live row. Modelled
      // directly: both closures close over the same stale snapshot, so the second write drops the first.
      const snapshot: ChallengeAbility = { id: ABILITY_ID, tag: '', flavor: '', consequences: [] };
      let abilities = seed();

      const staleCommitTag = () => { abilities = updateRowById(abilities, ABILITY_ID, { ...snapshot, tag: 'UnmountTag' }); };
      const staleCommitFlavor = () => { abilities = updateRowById(abilities, ABILITY_ID, { ...snapshot, flavor: 'UnmountFlavor' }); };

      staleCommitTag();
      staleCommitFlavor();

      // The flavor flush ran second and wrote `{...snapshot, flavor}` - snapshot.tag is '' - stomping the tag.
      expect(abilities[0]).toMatchObject({ tag: '', flavor: 'UnmountFlavor' });
   });
});
