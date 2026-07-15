// -- Other Library Imports --
import { create } from 'zustand';

/** Where the runner is in a step's sequence. Ephemeral, for observability. */
export type TutorialPhase = 'driving' | 'awaiting-anchor' | 'showing' | 'gated' | null;

/** Where to return when the tutorial exits. */
export type TutorialEntryPoint = 'onboarding' | 'settings' | null;

interface TutorialState {
   activeTutorialId: string | null;
   stepIndex: number;
   phase: TutorialPhase;
   entryPoint: TutorialEntryPoint;
   actions: {
      /** Starts a tutorial from step 0. */
      start: (id: string, entryPoint: TutorialEntryPoint) => void;
      /** Advances to the next step. */
      next: () => void;
      /** Steps back one (clamped at 0). */
      back: () => void;
      /** Jumps to an arbitrary step index (clamped at 0). */
      goTo: (index: number) => void;
      /** Leaves without completing (the X / Esc). */
      skip: () => void;
      /** Ends the run (reached the end, or an internal bail). */
      exit: () => void;
      /** The runner reports its per-step phase here. */
      setPhase: (phase: TutorialPhase) => void;
   };
}

/**
 * The running tutorial - EPHEMERAL, never serialized (dies on reload like `journey`). It
 * lives in a store, not component state, so the runner survives a DRIVE-induced tab switch
 * (which unmounts the previous surface). Persisted progress lands in appSettings later.
 */
export const useTutorialStore = create<TutorialState>((set) => ({
   activeTutorialId: null,
   stepIndex: 0,
   phase: null,
   entryPoint: null,
   actions: {
      start: (id, entryPoint) => set({ activeTutorialId: id, stepIndex: 0, phase: 'driving', entryPoint }),
      next: () => set((state) => (state.activeTutorialId ? { stepIndex: state.stepIndex + 1 } : {})),
      back: () => set((state) => (state.activeTutorialId ? { stepIndex: Math.max(0, state.stepIndex - 1) } : {})),
      goTo: (index) => set((state) => (state.activeTutorialId ? { stepIndex: Math.max(0, index) } : {})),
      skip: () => set({ activeTutorialId: null, stepIndex: 0, phase: null, entryPoint: null }),
      exit: () => set({ activeTutorialId: null, stepIndex: 0, phase: null, entryPoint: null }),
      setPhase: (phase) => set({ phase }),
   },
}));

/** Derived boolean for anything that used to read `isTourOpen` to suppress hotkeys. */
export const useIsTutorialActive = (): boolean => useTutorialStore((state) => state.activeTutorialId !== null);
