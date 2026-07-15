// -- React Imports --
import { useCallback, useEffect, useRef, useState } from 'react';

// -- Component Imports --
import TutorialOverlay from './TutorialOverlay';
import TutorialTooltip from './TutorialTooltip';

// -- Store Imports --
import { useTutorialStore } from '@/lib/tutorial/tutorialStore';
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useTabManagerStore } from '@/lib/character/tabManagerStore';

// -- Hook Imports --
import { useDeviceType } from '@/hooks/useDeviceType';

// -- Utils --
import { getTutorialDefinition } from '@/lib/tutorial/definitions';
import { runTutorialActions } from '@/lib/tutorial/runTutorialAction';
import { resolveAnchor } from '@/lib/tutorial/resolveAnchor';
import { getTutorialProfile } from '@/lib/tutorial/tutorialConfig';
import type { TutorialStep } from '@/lib/tutorial/tutorialTypes';

type RenderMode = 'spotlight' | 'centered' | 'bail' | null;

const NOOP = () => {};

/**
 * The platform-agnostic runner, mounted once as app chrome (above the tab-switch boundary),
 * so a DRIVE that switches tabs never unmounts it. Generalizes the mobile tutorial's proven
 * lifecycle: keyed on step INDEX; drive/teardown fire exactly once per transition guarded by
 * a memoized transition key (StrictMode-safe); per step it awaits the drive, then waits for
 * the anchor (event-driven, not a timer), then measures, spotlights, and arms `advance`.
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

   // Last known non-empty step list, reachable from the exit-teardown effect after the
   // active tutorial (and therefore `steps`) has already cleared.
   const stepsRef = useRef(steps);
   useEffect(() => {
      if (steps.length) stepsRef.current = steps;
   });

   const enteredIndexRef = useRef<number | null>(null);
   const driveRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
   const settledKeyRef = useRef<string | null>(null);
   const missStreakRef = useRef(0);
   const anchorElRef = useRef<HTMLElement | null>(null);

   const measure = useCallback((element: HTMLElement) => {
      anchorElRef.current = element;
      const rect = element.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
         element.scrollIntoView({ block: 'center' });
      }
      setDisplayRect(element.getBoundingClientRect());
   }, []);

   const advanceOrComplete = useCallback(() => {
      const { stepIndex: current, actions } = useTutorialStore.getState();
      if (current >= stepsRef.current.length - 1) actions.exit();
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
         const check = () => {
            if (signal.predicate()) advanceOrComplete();
         };
         const unsubscribers = [
            useAppGeneralStateStore.subscribe(check),
            useAppSettingsStore.subscribe(check),
            useTabManagerStore.subscribe(check),
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

      // Drive/teardown once per transition, memoized by key. A StrictMode re-invoke reuses
      // the SAME promise, so the drive never runs twice and is never cancelled mid-flight.
      if (!driveRef.current || driveRef.current.key !== key) {
         const previousIndex = enteredIndexRef.current;
         enteredIndexRef.current = stepIndex;
         const promise = (async () => {
            if (previousIndex !== null && previousIndex !== stepIndex) {
               await runTutorialActions(currentSteps[previousIndex]?.teardown);
            }
            setPhase('driving');
            await runTutorialActions(currentStep.drive);
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
            setPhase(currentStep.advance.on === 'user-action' ? 'gated' : 'showing');
            disarm = armAdvance(currentStep, element);
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

   // Tutorial ended: run the last-entered step's teardown, then reset engine state.
   useEffect(() => {
      if (activeTutorialId) return;
      const index = enteredIndexRef.current;
      if (index !== null) void runTutorialActions(stepsRef.current[index]?.teardown);
      enteredIndexRef.current = null;
      driveRef.current = null;
      settledKeyRef.current = null;
      missStreakRef.current = 0;
      anchorElRef.current = null;
      setDisplayRect(null);
      setMode(null);
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
   const gated = mode === 'spotlight' && step.advance.on === 'user-action';

   return (
      <>
         <TutorialOverlay
            targetRect={mode === 'spotlight' ? displayRect : null}
            padding={step.highlightPadding ?? profile.haloPadding}
            interaction={mode === 'spotlight' ? interaction : 'blocked'}
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
