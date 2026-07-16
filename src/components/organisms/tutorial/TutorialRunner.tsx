// -- React Imports --
import { useCallback, useEffect, useRef, useState } from 'react';

// -- Component Imports --
import TutorialOverlay from './TutorialOverlay';
import TutorialTooltip from './TutorialTooltip';

// -- Store Imports --
import { useTutorialStore, returnToEntryPoint } from '@/lib/tutorial/tutorialStore';
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useTabManagerStore } from '@/lib/character/tabManagerStore';
import { useNavigatorStore } from '@/lib/navigator/navigatorStore';
import { getActiveCharacterStore } from '@/lib/character/characterStoreRegistry';
import { getActiveNoteStore } from '@/lib/notes/noteStoreRegistry';

// -- Hook Imports --
import { useDeviceType } from '@/hooks/useDeviceType';

// -- Utils --
import { getTutorialDefinition } from '@/lib/tutorial/definitions';
import { runTutorialActions } from '@/lib/tutorial/runTutorialAction';
import { resolveAnchor } from '@/lib/tutorial/resolveAnchor';
import { getTutorialProfile } from '@/lib/tutorial/tutorialConfig';
import { seedDemo, teardownDemo } from '@/lib/tutorial/demo/demoContentHandler';
import { captureChromeSnapshot, restoreChromeSnapshot } from '@/lib/tutorial/chromeSnapshot';
import type { TutorialStep } from '@/lib/tutorial/tutorialTypes';
import type { DemoHandle } from '@/lib/tutorial/demo/demoContentHandler';
import type { ChromeSnapshot } from '@/lib/tutorial/chromeSnapshot';
import type { TutorialEntryPoint } from '@/lib/tutorial/tutorialStore';

type RenderMode = 'spotlight' | 'centered' | 'bail' | null;

const NOOP = () => {};

/**
 * The platform-agnostic runner, mounted once as app chrome (above the tab-switch boundary),
 * so a drive that switches tabs never unmounts it. Generalizes the mobile tutorial's proven
 * lifecycle: keyed on step INDEX; the leave + arrive hooks fire exactly once per transition
 * guarded by a memoized transition key (StrictMode-safe); per step it awaits `onArrive`, then
 * waits for the anchor (event-driven, not a timer), then measures, spotlights, and arms `advance`.
 *
 * Lifecycle hooks NEVER auto-reverse - whatever a hook sets persists. A forward transition N -> N+1
 * runs, awaited in order: `N.onLeave` -> `N.onForward` -> `(N+1).onArrive`; a back transition
 * N -> N-1 runs `N.onLeave` -> `N.onBack` -> `(N-1).onArrive`. Direction is derived from the last
 * entered index. On start the whole app-chrome state is snapshotted; on skip / exit / complete the
 * runner runs the leaving step's `onLeave`, restores that snapshot, disposes any demo, and returns
 * to the entry point - so the app lands exactly where it was before the run.
 */
export default function TutorialRunner() {
   const activeTutorialId = useTutorialStore((state) => state.activeTutorialId);
   const stepIndex = useTutorialStore((state) => state.stepIndex);
   const setPhase = useTutorialStore((state) => state.actions.setPhase);

   const { deviceType } = useDeviceType();
   const profile = getTutorialProfile(deviceType);

   const definition = activeTutorialId ? getTutorialDefinition(activeTutorialId) : null;
   const steps = definition?.steps ?? [];
   const step: TutorialStep | undefined = steps[stepIndex];

   const [displayRect, setDisplayRect] = useState<DOMRect | null>(null);
   const [mode, setMode] = useState<RenderMode>(null);
   // A store gate already satisfied when its step arrives (back-nav into an add-status whose action can't be
   // undone) shows a Next instead of auto-advancing, so back-navigation can actually land on it.
   const [gateSatisfiedOnArrival, setGateSatisfiedOnArrival] = useState(false);

   // Last known non-empty step list, reachable from the exit-teardown effect after the
   // active tutorial (and therefore `steps`) has already cleared.
   const stepsRef = useRef(steps);
   useEffect(() => {
      if (steps.length) stepsRef.current = steps;
   });

   const enteredIndexRef = useRef<number | null>(null);
   const demoHandleRef = useRef<DemoHandle | null>(null);
   const chromeSnapshotRef = useRef<ChromeSnapshot | null>(null);
   const entryPointRef = useRef<TutorialEntryPoint>(null);
   const driveRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
   const settledKeyRef = useRef<string | null>(null);
   const missStreakRef = useRef(0);
   const anchorElRef = useRef<HTMLElement | null>(null);
   const followRafRef = useRef<number | null>(null);
   const anchorResizeObsRef = useRef<ResizeObserver | null>(null);

   const measure = useCallback((element: HTMLElement) => {
      anchorElRef.current = element;
      const rect = element.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
         element.scrollIntoView({ block: 'center' });
      }
      setDisplayRect(element.getBoundingClientRect());
      // Continuous size tracking: a ResizeObserver catches a LATER size change the bounded rAF-follow below
      // misses - e.g. the card-creation dialog growing when the user picks a type - so the spotlight keeps
      // hugging the anchor for as long as the step is up. (The rAF-follow handles transform / position
      // animations a ResizeObserver can't see, like the Dice Tray slide; together they cover every case.)
      anchorResizeObsRef.current?.disconnect();
      const observer = new ResizeObserver(() => setDisplayRect(element.getBoundingClientRect()));
      observer.observe(element);
      anchorResizeObsRef.current = observer;
      // Follow the anchor through its open animation. A panel the prior gate just opened (Drawer, Navigator,
      // Dice Tray) is still animating when first measured - a width grow, a height grow, or a transform slide -
      // so re-measure each frame until its rect holds still (or a frame cap). A ResizeObserver alone can't see
      // a transform/position animation (the border box never changes size), so the halo would freeze on the
      // opening frame; a rAF follow catches every kind.
      if (followRafRef.current !== null) cancelAnimationFrame(followRafRef.current);
      let last = element.getBoundingClientRect();
      let stable = 0;
      let frames = 0;
      const follow = () => {
         const next = element.getBoundingClientRect();
         setDisplayRect(next);
         const moved = next.top !== last.top || next.left !== last.left || next.width !== last.width || next.height !== last.height;
         last = next;
         stable = moved ? 0 : stable + 1;
         frames += 1;
         followRafRef.current = stable < 3 && frames < 90 ? requestAnimationFrame(follow) : null;
      };
      followRafRef.current = requestAnimationFrame(follow);
   }, []);

   const advanceOrComplete = useCallback(() => {
      const { stepIndex: current, actions } = useTutorialStore.getState();
      if (current >= stepsRef.current.length - 1) actions.complete();
      else actions.next();
   }, []);

   // Arms the step's advance signal; returns a disarm callback.
   const armAdvance = useCallback(
      (armStep: TutorialStep, anchor: HTMLElement | null): (() => void) => {
         const advance = armStep.advance;

         if (advance.on === 'auto') {
            const timer = window.setTimeout(advanceOrComplete, advance.afterMs ?? 0);
            return () => window.clearTimeout(timer);
         }
         if (advance.on !== 'user-action') return NOOP;

         const signal = advance.signal;
         if (signal.kind === 'dom-event') {
            if (!anchor) return NOOP;
            const event = signal.event ?? 'click';
            const handler = () => advanceOrComplete();
            anchor.addEventListener(event, handler);
            return () => anchor.removeEventListener(event, handler);
         }

         // Store predicate: satisfied now, or on the next relevant store change.
         if (signal.predicate()) {
            advanceOrComplete();
            return NOOP;
         }
         // Fire AT MOST once. The action that satisfies a gate often fires a SECOND synchronous store change
         // right after (creating a card closes its dialog), and the predicate is still true - without this
         // guard the gate advances twice and skips the next step (add-journal, in the card case).
         let fired = false;
         const check = () => {
            if (fired || !signal.predicate()) return;
            fired = true;
            advanceOrComplete();
         };
         // A gate may read a store outside the app-level trio: the ACTIVE character store (create a status,
         // story tag, card, journal, or portrait), the ACTIVE note store (type into the note body), or the
         // Navigator (crawl a caret to grow `expandedIds`). Subscribe to each, else those mutations fire on a
         // store nothing here listens to and the gate never advances.
         const characterStore = getActiveCharacterStore();
         const noteStore = getActiveNoteStore();
         const unsubscribers = [
            useAppGeneralStateStore.subscribe(check),
            useAppSettingsStore.subscribe(check),
            useTabManagerStore.subscribe(check),
            useNavigatorStore.subscribe(check),
            ...(characterStore ? [characterStore.subscribe(check)] : []),
            ...(noteStore ? [noteStore.subscribe(check)] : []),
         ];
         return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
      },
      [advanceOrComplete],
   );

   // Per-step lifecycle.
   useEffect(() => {
      if (!activeTutorialId || !definition) return;
      const currentSteps = stepsRef.current;
      const currentStep = currentSteps[stepIndex];
      if (!currentStep) return;
      const key = `${activeTutorialId}:${stepIndex}`;
      // Reset until this step's settle decides, so a prior step's "already satisfied" flag never lingers.
      setGateSatisfiedOnArrival(false);

      // Leave + arrive once per transition, memoized by key. A StrictMode re-invoke reuses the
      // SAME promise, so the hooks never run twice and are never cancelled mid-flight.
      if (!driveRef.current || driveRef.current.key !== key) {
         const previousIndex = enteredIndexRef.current;
         enteredIndexRef.current = stepIndex;
         const promise = (async () => {
            // Initial entry: snapshot the app-chrome state for exit-restore, then seed the demo content
            // (if any) BEFORE the first `onArrive`, so the surface is mounted before any anchor is queried
            // (the hooks and the anchor wait already await this promise).
            if (previousIndex === null) {
               chromeSnapshotRef.current = captureChromeSnapshot();
               entryPointRef.current = useTutorialStore.getState().entryPoint;
               if (definition.needsDemo && !demoHandleRef.current) {
                  setPhase('seeding');
                  demoHandleRef.current = await seedDemo(definition.needsDemo);
               }
            }
            if (previousIndex !== null && previousIndex !== stepIndex) {
               // Leaving the previous step: run its `onLeave` (either direction) then the directional hook.
               const leavingStep = currentSteps[previousIndex];
               const goingForward = stepIndex > previousIndex;
               await runTutorialActions(leavingStep?.onLeave);
               await runTutorialActions(goingForward ? leavingStep?.onForward : leavingStep?.onBack);
            }
            setPhase('driving');
            await runTutorialActions(currentStep.onArrive);
         })();
         driveRef.current = { key, promise };
      }
      const drivePromise = driveRef.current.promise;

      let cancelled = false;
      let disarm: () => void = NOOP;

      void (async () => {
         await drivePromise;
         if (cancelled) return;

         // Centered/modal beat: no anchor to resolve.
         if (!currentStep.anchorKey) {
            missStreakRef.current = 0;
            settledKeyRef.current = key;
            anchorElRef.current = null;
            setDisplayRect(null);
            setMode('centered');
            setPhase('showing');
            disarm = armAdvance(currentStep, null);
            return;
         }

         setPhase('awaiting-anchor');
         const element = await resolveAnchor(currentStep.anchorKey);
         if (cancelled) return;

         if (element) {
            missStreakRef.current = 0;
            settledKeyRef.current = key;
            measure(element);
            setMode('spotlight');
            // A store gate already satisfied on arrival must NOT auto-advance - that bounces back-navigation
            // straight forward again. Show it with a Next instead; only arm the wait when it isn't done yet.
            const alreadyDone = currentStep.advance.on === 'user-action'
               && currentStep.advance.signal.kind === 'store'
               && currentStep.advance.signal.predicate();
            setGateSatisfiedOnArrival(alreadyDone);
            setPhase(currentStep.advance.on === 'user-action' ? 'gated' : 'showing');
            if (!alreadyDone) disarm = armAdvance(currentStep, element);
            return;
         }

         // Missing anchor: settle the outcome exactly once per step.
         if (settledKeyRef.current === key) return;
         settledKeyRef.current = key;
         missStreakRef.current += 1;

         if (missStreakRef.current >= 2) {
            anchorElRef.current = null;
            setDisplayRect(null);
            setMode('bail');
            setPhase('showing');
            return;
         }
         if (currentStep.required) {
            anchorElRef.current = null;
            setDisplayRect(null);
            setMode('centered');
            setPhase('showing');
            disarm = armAdvance(currentStep, null);
            return;
         }
         if (import.meta.env.DEV) {
            console.warn(`[tutorial] anchor "${currentStep.anchorKey}" missing; skipping step "${currentStep.id}".`);
         }
         advanceOrComplete();
      })();

      return () => {
         cancelled = true;
         disarm();
      };
   }, [activeTutorialId, stepIndex, definition, measure, armAdvance, advanceOrComplete, setPhase]);

   // Tutorial ended (skip / exit / complete alike): run the last-entered step's `onLeave`, THEN restore
   // the app-chrome snapshot (so Edit mode and every panel land back where the user had them), discard any
   // demo content (a hook may still reference it, and its teardown re-asserts the prior workspace), and
   // finally return to the entry point (reopening Settings on Learn for a settings-launched run - it runs
   // last so it wins over the snapshot, which captured the hub closed). No-ops when no run was in flight.
   useEffect(() => {
      if (activeTutorialId) return;
      const index = enteredIndexRef.current;
      const demoHandle = demoHandleRef.current;
      const snapshot = chromeSnapshotRef.current;
      const entryPoint = entryPointRef.current;
      const stepLeave = index !== null ? runTutorialActions(stepsRef.current[index]?.onLeave) : Promise.resolve();
      void Promise.resolve(stepLeave).then(() => {
         if (snapshot) restoreChromeSnapshot(snapshot);
         if (demoHandle) teardownDemo(demoHandle);
         if (snapshot) returnToEntryPoint(entryPoint);
      });
      demoHandleRef.current = null;
      chromeSnapshotRef.current = null;
      entryPointRef.current = null;
      enteredIndexRef.current = null;
      driveRef.current = null;
      settledKeyRef.current = null;
      missStreakRef.current = 0;
      anchorElRef.current = null;
      setDisplayRect(null);
      setMode(null);
      if (followRafRef.current !== null) cancelAnimationFrame(followRafRef.current);
      followRafRef.current = null;
      anchorResizeObsRef.current?.disconnect();
      anchorResizeObsRef.current = null;
   }, [activeTutorialId]);

   // Keep the spotlight on its anchor through scroll/resize.
   useEffect(() => {
      if (mode !== 'spotlight') return;
      const reposition = () => {
         const element = anchorElRef.current;
         if (element) setDisplayRect(element.getBoundingClientRect());
      };
      window.addEventListener('resize', reposition);
      window.addEventListener('scroll', reposition, true);
      return () => {
         window.removeEventListener('resize', reposition);
         window.removeEventListener('scroll', reposition, true);
      };
   }, [mode]);

   // Esc leaves the tutorial (no confirmation - every tutorial is replayable).
   useEffect(() => {
      if (!activeTutorialId) return;
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key === 'Escape') {
            event.stopPropagation();
            useTutorialStore.getState().actions.skip();
         }
      };
      window.addEventListener('keydown', onKeyDown, true);
      return () => window.removeEventListener('keydown', onKeyDown, true);
   }, [activeTutorialId]);

   // Body scroll lock while running (matches the app's own overflow-hidden shell).
   useEffect(() => {
      if (!activeTutorialId) return;
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
         document.body.style.overflow = previous;
      };
   }, [activeTutorialId]);

   if (!activeTutorialId || !definition || !step) return null;

   const actions = useTutorialStore.getState().actions;
   const interaction = step.interaction ?? 'blocked';
   const gated = mode === 'spotlight' && step.advance.on === 'user-action' && !gateSatisfiedOnArrival;
   // A `scrim:'none'` step drops the veil only once its coach-mark is up (spotlight or centered); the
   // transient driving / awaiting-anchor frames keep the dim so the app never flashes fully lit mid-move.
   const scrim = (mode === 'spotlight' || mode === 'centered') && step.scrim === 'none' ? 'none' : 'dim';

   return (
      <>
         <TutorialOverlay
            targetRect={mode === 'spotlight' ? displayRect : null}
            padding={step.highlightPadding ?? profile.haloPadding}
            interaction={mode === 'spotlight' ? interaction : 'blocked'}
            scrim={scrim}
         />
         {mode && (
            <TutorialTooltip
               variant={mode}
               titleKey={step.titleKey}
               bodyKey={step.bodyKey}
               tutorialNameKey={definition.titleKey}
               currentStep={stepIndex}
               totalSteps={steps.length}
               targetRect={mode === 'spotlight' ? displayRect : null}
               placement={step.placement}
               profile={profile}
               gated={gated}
               isFirst={stepIndex === 0}
               isLast={stepIndex >= steps.length - 1}
               onNext={advanceOrComplete}
               onBack={actions.back}
               onSkip={actions.skip}
               onSkipStep={advanceOrComplete}
            />
         )}
      </>
   );
}
