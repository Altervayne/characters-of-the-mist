// @vitest-environment jsdom

// -- Library Imports --
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

// -- Unit Under Test --
import { createCharacterStore, type CharacterStore } from '@/lib/stores/characterStore';
import { createEmbedSync, useEmbedCharacterStore } from '@/lib/board/useEmbedCharacterStore';

// -- Type Imports --
import type { Card } from '@/lib/types/character';

/*
 * Locks the flush-on-unmount invariant for a board EMBED copy: a buffered field edit MUST reach the board
 * even though the field's flush-on-unmount fires AFTER the embed sync tears down. A deleted subtree unmounts
 * parent-first, so `useEmbedCharacterStore`'s dispose (parent) runs before the field's flush (deep child):
 * the flush writes the last edit into the per-embed store with the subscription already gone. The sync's
 * `flush` (a guarded final read-and-commit, deferred past the synchronous unmount pass) recovers it, and the
 * guard no-ops a value the live subscription already forwarded so nothing double-commits.
 */

// A minimal challenge card; only id / details are load-bearing for the embed sync.
const card = (flavor: string): Card =>
   ({ id: 'card-1', title: 'x', isFlipped: false, cardType: 'CHALLENGE_CARD', details: { game: 'legend', flavor } } as unknown as Card);

const flavorOf = (value: unknown) => (value as Card).details as { flavor: string };

const pausedStore = (): CharacterStore => {
   const store = createCharacterStore();
   store.temporal.getState().pause();
   return store;
};

afterEach(cleanup);

describe('createEmbedSync teardown', () => {
   it('flush() commits a field write that landed after dispose (nothing subscribed)', () => {
      const store = pausedStore();
      const onCommit = vi.fn();
      const sync = createEmbedSync(store, 'cards', card('before'), onCommit);

      sync.dispose(); // parent cleanup: the subscription is gone
      store.getState().actions.updateCardDetails('card-1', { flavor: 'typed' }); // the field's later flush
      expect(onCommit).not.toHaveBeenCalled();

      sync.flush(); // deferred final read-and-commit
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(flavorOf(onCommit.mock.calls[0][0]).flavor).toBe('typed');
   });

   it('flush() does not double-commit a value the live subscription already forwarded', () => {
      const store = pausedStore();
      const onCommit = vi.fn();
      const sync = createEmbedSync(store, 'cards', card('before'), onCommit);

      store.getState().actions.updateCardDetails('card-1', { flavor: 'typed' }); // subscription forwards once
      expect(onCommit).toHaveBeenCalledTimes(1);

      sync.flush(); // same value -> guard no-ops
      expect(onCommit).toHaveBeenCalledTimes(1);
      sync.dispose();
   });

   it('flush() no-ops on a clean teardown (no edit)', () => {
      const store = pausedStore();
      const onCommit = vi.fn();
      const sync = createEmbedSync(store, 'cards', card('before'), onCommit);

      sync.dispose();
      sync.flush();
      expect(onCommit).not.toHaveBeenCalled();
   });
});

describe('useEmbedCharacterStore flush-on-unmount', () => {
   // Mirrors a debounced field: writes its buffered edit into the embed store on unmount, which - a deleted
   // subtree unmounting parent-first - runs after the host's sync has already disposed.
   function FlushChild({ store }: { store: CharacterStore }) {
      useEffect(() => () => { store.getState().actions.updateCardDetails('card-1', { flavor: 'typed' }); }, [store]);
      return null;
   }

   function EmbedHost({ onCommit }: { onCommit: (next: unknown) => void }) {
      const store = useEmbedCharacterStore({ slot: 'cards', data: card('before'), onCommit });
      return <FlushChild store={store} />;
   }

   it('commits the field flush that lands after the sync disposes', async () => {
      const onCommit = vi.fn();
      const { unmount } = render(<EmbedHost onCommit={onCommit} />);

      unmount();

      await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
      expect(flavorOf(onCommit.mock.calls[0][0]).flavor).toBe('typed');
   });
});
