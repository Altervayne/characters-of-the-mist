// -- Library Imports --
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// The repository read + the engine signal are mocked so the loader's logic is exercised in isolation.
vi.mock('@/lib/drawer/drawerRepository', () => ({ getItem: vi.fn() }));
vi.mock('@/lib/drawer/drawerCommandEngine', () => ({ drawerCommandEngine: { subscribe: vi.fn() } }));

// -- Local Imports (after the mocks so the module binds the mocked deps at import) --
import { getItem } from '@/lib/drawer/drawerRepository';
import { drawerCommandEngine } from '@/lib/drawer/drawerCommandEngine';
import {
   fetchDrawerItemContent,
   runDrawerItemContentFetch,
   subscribeDrawerContentVersion,
   getDrawerContentVersion,
} from './useDrawerItemContent';

/*
 * The lazy content loader. React rendering isn't available in this node env, so the loader's logic is
 * factored into framework-free pieces (fetch, stale-guard runner, the invalidation version) and tested
 * directly; the hook is a thin wrapper that drives a fetch off `[id, version]`.
 */

describe('useDrawerItemContent loader', () => {
   beforeEach(() => {
      (getItem as Mock).mockReset();
   });

   it('fetches content on mount (the record, not missing)', async () => {
      (getItem as Mock).mockResolvedValueOnce({ id: 'a', name: 'A' });
      expect(await fetchDrawerItemContent('a')).toEqual({ item: { id: 'a', name: 'A' }, isMissing: false });
      expect(getItem).toHaveBeenCalledWith('a');
   });

   it('settles isMissing for an absent id (a deleted item), not a perpetual spinner', async () => {
      (getItem as Mock).mockResolvedValueOnce(undefined);
      expect(await fetchDrawerItemContent('gone')).toEqual({ item: undefined, isMissing: true });
   });

   it('settles isMissing when the read throws', async () => {
      (getItem as Mock).mockRejectedValueOnce(new Error('read failed'));
      expect(await fetchDrawerItemContent('boom')).toEqual({ item: undefined, isMissing: true });
   });

   it('re-fetches on id change: getItem is called with the new id', async () => {
      (getItem as Mock).mockResolvedValue(undefined);
      await runDrawerItemContentFetch('id-1', () => true, vi.fn());
      await runDrawerItemContentFetch('id-2', () => true, vi.fn());
      expect(getItem).toHaveBeenCalledWith('id-1');
      expect(getItem).toHaveBeenCalledWith('id-2');
   });

   it('stale-resolve guard: a result is dropped when no longer current, applied when current', async () => {
      (getItem as Mock).mockResolvedValue({ id: 'a' });

      const onStale = vi.fn();
      await runDrawerItemContentFetch('a', () => false, onStale); // id/version moved on mid-fetch
      expect(onStale).not.toHaveBeenCalled();

      const onCurrent = vi.fn();
      await runDrawerItemContentFetch('a', () => true, onCurrent);
      expect(onCurrent).toHaveBeenCalledWith({ item: { id: 'a' }, isMissing: false });
   });

   it('a command-engine fire bumps the content version and notifies subscribers (the re-fetch signal)', () => {
      // The module registered ONE engine subscription at import; grab that callback.
      const engineFire = (drawerCommandEngine.subscribe as Mock).mock.calls[0][0] as () => void;
      const before = getDrawerContentVersion();

      const listener = vi.fn();
      const unsubscribe = subscribeDrawerContentVersion(listener);
      engineFire(); // e.g. an updateItemContent command landed

      expect(getDrawerContentVersion()).toBe(before + 1);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      engineFire();
      expect(listener).toHaveBeenCalledTimes(1); // no longer notified after unsubscribe
   });
});
