// -- Testing Imports --
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// -- Store Imports --
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';

// -- Utils --
import { runTutorialAction, runTutorialActions } from './runTutorialAction';

/**
 * The mobile nav drive is the one action whose completion the runner genuinely has to wait on: the page
 * consumes the queue from an effect, so a drive that resolved early would let the runner measure and bind
 * against a surface the page has not moved yet. These cover the contract that makes the await real - it
 * settles on the drain - and the one that keeps it from ever freezing a run: it settles regardless.
 */

const NAV_ACTION = { type: 'mobileNav', action: { kind: 'navTab', tab: 'drawer' } } as const;

/** Stands in for the page: drains the queue the way the consume effect does. */
function drain() {
   useAppGeneralStateStore.getState().actions.clearMobileNavActions();
}

/** Wraps `subscribe` so a test can assert the drive let go of the store. */
function trackSubscriptions() {
   const counts = { subscribed: 0, unsubscribed: 0 };
   const real = useAppGeneralStateStore.subscribe.bind(useAppGeneralStateStore);
   vi.spyOn(useAppGeneralStateStore, 'subscribe').mockImplementation(((listener: Parameters<typeof real>[0]) => {
      counts.subscribed += 1;
      const off = real(listener);
      return () => {
         counts.unsubscribed += 1;
         off();
      };
   }) as typeof real);
   return counts;
}

describe('runTutorialAction / mobileNav', () => {
   beforeEach(() => {
      useAppGeneralStateStore.setState({ pendingMobileNavActions: [] });
   });

   afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
   });

   it('queues the action synchronously and stays pending until the page drains', async () => {
      const promise = runTutorialAction(NAV_ACTION) as Promise<void>;
      expect(useAppGeneralStateStore.getState().pendingMobileNavActions).toEqual([NAV_ACTION.action]);

      let resolved = false;
      void promise.then(() => {
         resolved = true;
      });
      await Promise.resolve();
      expect(resolved).toBe(false);

      drain();
      await promise;
      expect(resolved).toBe(true);
   });

   it('resolves on the timeout when nothing is mounted to consume the queue', async () => {
      vi.useFakeTimers();
      const promise = runTutorialAction(NAV_ACTION) as Promise<void>;

      let resolved = false;
      void promise.then(() => {
         resolved = true;
      });
      await vi.advanceTimersByTimeAsync(999);
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await promise;
      expect(resolved).toBe(true);
      // The queue is deliberately left alone: nothing consumed it, so nothing may claim it was consumed.
      expect(useAppGeneralStateStore.getState().pendingMobileNavActions).toHaveLength(1);
   });

   it('settles once: a later drain after the timeout, and repeated drains, both no-op', async () => {
      vi.useFakeTimers();
      const counts = trackSubscriptions();
      const settle = vi.fn();
      const promise = (runTutorialAction(NAV_ACTION) as Promise<void>).then(settle);

      await vi.advanceTimersByTimeAsync(1000);
      await promise;
      expect(settle).toHaveBeenCalledTimes(1);

      // The subscription is gone, so these can neither re-resolve nor reach a dead listener.
      expect(counts.unsubscribed).toBe(counts.subscribed);
      drain();
      drain();
      await vi.advanceTimersByTimeAsync(5000);
      expect(settle).toHaveBeenCalledTimes(1);
   });

   it('releases its store subscription and its timer on a normal drain', async () => {
      vi.useFakeTimers();
      const counts = trackSubscriptions();
      const promise = runTutorialAction(NAV_ACTION) as Promise<void>;
      expect(counts.subscribed).toBe(1);

      drain();
      await promise;
      expect(counts.unsubscribed).toBe(1);

      // A pending timer would keep the run alive past its own drain; the drain must have cleared it.
      expect(vi.getTimerCount()).toBe(0);
   });

   it('awaits each action of a batch in order, one drain apiece', async () => {
      const seen: string[] = [];
      const unsubscribe = useAppGeneralStateStore.subscribe((state) => {
         const queued = state.pendingMobileNavActions;
         if (queued.length === 0) return;
         seen.push(queued.map((a) => a.kind).join(','));
         // The page drains whatever it finds, exactly as the consume effect does.
         queueMicrotask(drain);
      });

      await runTutorialActions([
         { type: 'mobileNav', action: { kind: 'navTab', tab: 'drawer' } },
         { type: 'mobileNav', action: { kind: 'fab', expanded: true } },
         { type: 'mobileNav', action: { kind: 'toolbelt', open: false } },
      ]);
      unsubscribe();

      // Each action waits for its own drain, so no action is ever queued behind an unconsumed one.
      expect(seen).toEqual(['navTab', 'fab', 'toolbelt']);
      expect(useAppGeneralStateStore.getState().pendingMobileNavActions).toEqual([]);
   });
});
