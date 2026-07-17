// -- Other Library Imports --
import { create } from 'zustand';

// -- Store Imports --
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

/** Where the runner is in a step's sequence. Ephemeral, for observability. */
export type TutorialPhase = 'seeding' | 'driving' | 'awaiting-anchor' | 'showing' | 'gated' | null;

/** Where to return when the tutorial exits. */
export type TutorialEntryPoint = 'onboarding' | 'settings' | null;

/**
 * Sends the user back where they launched from once a run ends. A settings-launched run reopens the hub on
 * Learn so the list is right there to start the next one; an onboarding-launched run just lands in the app.
 * The runner calls this as the LAST step of its exit sequence - AFTER the chrome snapshot is restored - so
 * the settings reopen wins over the snapshot (which captured the hub closed, since launching closes it).
 */
export function returnToEntryPoint(entryPoint: TutorialEntryPoint): void {
   if (entryPoint !== 'settings') return;
   const { setSettingsInitialSection, setSettingsOpen } = useAppGeneralStateStore.getState().actions;
   setSettingsInitialSection('learn');
   setSettingsOpen(true);
}

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
      /** Ends the run without marking it complete (an internal bail). */
      exit: () => void;
      /** Ends the run at its final step: records completion, then returns to the entry point. */
      complete: () => void;
      /** The runner reports its per-step phase here. */
      setPhase: (phase: TutorialPhase) => void;
   };
}

/**
 * The running tutorial - EPHEMERAL, never serialized (dies on reload like `journey`). It
 * lives in a store, not component state, so the runner survives a DRIVE-induced tab switch
 * (which unmounts the previous surface). Persisted progress lands in appSettings later.
 */
const CLEARED = { activeTutorialId: null, stepIndex: 0, phase: null, entryPoint: null } as const;

export const useTutorialStore = create<TutorialState>((set, get) => ({
   activeTutorialId: null,
   stepIndex: 0,
   phase: null,
   entryPoint: null,
   actions: {
      start: (id, entryPoint) => set({ activeTutorialId: id, stepIndex: 0, phase: 'driving', entryPoint }),
      next: () => set((state) => (state.activeTutorialId ? { stepIndex: state.stepIndex + 1 } : {})),
      back: () => set((state) => (state.activeTutorialId ? { stepIndex: Math.max(0, state.stepIndex - 1) } : {})),
      goTo: (index) => set((state) => (state.activeTutorialId ? { stepIndex: Math.max(0, index) } : {})),
      // skip / exit / complete only clear the store; the runner watches the clear and runs the leaving
      // step's `onLeave`, restores the chrome snapshot, disposes the demo, then returns to the entry point
      // (order matters, so the whole exit sequence lives in one place - the runner - not split with the store).
      skip: () => set(CLEARED),
      exit: () => set(CLEARED),
      complete: () => {
         const { activeTutorialId } = get();
         if (activeTutorialId) useAppSettingsStore.getState().actions.markTutorialCompleted(activeTutorialId);
         set(CLEARED);
      },
      setPhase: (phase) => set({ phase }),
   },
}));

/** Derived boolean for anything that needs to suppress hotkeys while a tutorial runs. */
export const useIsTutorialActive = (): boolean => useTutorialStore((state) => state.activeTutorialId !== null);
