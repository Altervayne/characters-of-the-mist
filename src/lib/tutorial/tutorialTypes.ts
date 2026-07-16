// -- Type Imports --
import type { LucideIcon } from 'lucide-react';
import type { BoardAction } from '@/lib/stores/appGeneralStateStore';

export type TutorialPlatform = 'mobile' | 'desktop';
export type TutorialSystem =
   | 'onboarding'
   | 'navigation'
   | 'sheet'
   | 'board'
   | 'notes'
   | 'portals'
   | 'drawer'
   | 'themes';
export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

/**
 * A named, serializable app-drive descriptor. Resolved fresh against the live stores at
 * dispatch time (see {@link ./runTutorialAction}) - a definition never captures a setter,
 * so it stays static data and survives component refactors. Only idempotent, harmless
 * verbs live here: focus-or-open an existing tab, toggle a flag, open a dialog. Nothing
 * that writes a new record (the engine performs zero repository writes).
 */
export type TutorialAction =
   | { type: 'openBoardTab'; boardId: string }
   | { type: 'openNoteTab'; noteId: string }
   | { type: 'setActiveTab'; tabId: string }
   | { type: 'deactivateToMenu' }
   | { type: 'setEditing'; value: boolean }
   | { type: 'setDrawer'; mode: 'closed' | 'open' | 'expanded' }
   | { type: 'setNavigator'; open: boolean }
   | { type: 'setDiceTray'; open: boolean }
   | { type: 'setCommandPalette'; open: boolean }
   | { type: 'openSettings'; section?: string }
   | { type: 'closeSettings' }
   | { type: 'setSettingsSection'; section: string }
   | { type: 'board'; action: BoardAction };

/** How a gated step detects the user's real action. */
export type AdvanceSignal =
   /** Watch app state: advance when the predicate (read fresh against the stores) flips true. */
   | { kind: 'store'; predicate: () => boolean }
   /** Watch a UI-only gesture on the resolved anchor with no state signal (default `click`). */
   | { kind: 'dom-event'; event?: string };

/** The hybrid advance mode, authored per step. */
export type TutorialAdvance =
   /** Driven/read step: the user reads and clicks Next. Never auto-advances. */
   | { on: 'next-click' }
   /** Gated step: the user's real action advances; no Next button. */
   | { on: 'user-action'; signal: AdvanceSignal }
   /** A pure self-advancing beat. Rare. */
   | { on: 'auto'; afterMs?: number };

export interface TutorialStep {
   id: string;
   /** `data-tutorial="<key>"` target. Absent means a centered/modal step. */
   anchorKey?: string;
   titleKey: string;
   bodyKey: string;
   placement?: TutorialPlacement;
   highlightPadding?: number;
   /*
    * Step lifecycle hooks. Each runs its actions through `runTutorialAction` (store-fresh), awaited in
    * order. Nothing is ever auto-reversed: whatever a hook sets PERSISTS. Author `onArrive` to
    * IDEMPOTENTLY ensure the step's required state (e.g. "the drawer is open") so back-navigation
    * re-establishes it; put the cleanup that hands off to the next section in `onForward` / `onLeave`.
    */
   /** Runs when the step becomes active, entered from EITHER direction. */
   onArrive?: TutorialAction | TutorialAction[];
   /** Runs when the step is left, in EITHER direction (also on skip / exit / complete). */
   onLeave?: TutorialAction | TutorialAction[];
   /** Runs when leaving this step toward the NEXT step. */
   onForward?: TutorialAction | TutorialAction[];
   /** Runs when leaving this step toward the PREVIOUS step. */
   onBack?: TutorialAction | TutorialAction[];
   advance: TutorialAdvance;
   /** Overlay hit-testing. Gated steps require `anchor-only` so the real anchor is clickable. */
   interaction?: 'blocked' | 'anchor-only';
   /**
    * Full-screen veil (default `'dim'`). `'none'` renders no veil - coach-mark only, with just a
    * non-dimming ring at the anchor - so a dialog / dropdown / dice-tray / palette the user opened
    * stays lit and visible instead of buried under the dim. Pair with `interaction:'anchor-only'`.
    */
   scrim?: 'dim' | 'none';
   /** A missing anchor bails the tutorial when `true`, otherwise the step is skipped. */
   required?: boolean;
}

export interface TutorialDefinition {
   id: string;
   platform: TutorialPlatform;
   system: TutorialSystem;
   /** Name shown in the list row and the coach-mark header. */
   titleKey: string;
   /** One-line "what it teaches" for the list row. */
   teachKey: string;
   /** Per-tutorial glyph for the list row (consumed by the tutorials list). */
   icon?: LucideIcon;
   /**
    * When set, the engine seeds isolated demo content before the first step and discards it on exit.
    * Only `'character'` is built today (board + portal-graph extend this as their tutorials land).
    */
   needsDemo?: 'character';
   steps: TutorialStep[];
}
