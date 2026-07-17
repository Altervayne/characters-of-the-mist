// -- Type Imports --
import type { TutorialDefinition, TutorialStep } from './tutorialTypes';

/**
 * A definition's steps as the ACTIVE nav shell needs them. The mobile shell comes in two forms - the bottom
 * bar and the FAB ring - which expose different controls, so a beat may carry a `fabMode` override for the
 * anchor, copy, placement or arrival state that differs there, or a `shell` that drops it from the other one
 * entirely (the ring is a control the bar has no equivalent of, so the beats that work it are the ring's
 * alone). A beat with neither is identical in both shells, and a definition using neither - every desktop
 * tour - passes through by identity. The result is the step list each shell counts and indexes against, so
 * each shows its own length rather than a blend of the two.
 */
export function resolveShellSteps(definition: TutorialDefinition | null, isFabMode: boolean): TutorialStep[] {
   if (!definition) return [];
   const shell = isFabMode ? 'fab' : 'navbar';
   const scoped = definition.steps.filter((step) => !step.shell || step.shell === shell);
   const steps = scoped.length === definition.steps.length ? definition.steps : scoped;
   if (!isFabMode) return steps;
   return steps.map((step) => {
      if (!step.fabMode) return step;
      const { fabMode, ...base } = step;
      return { ...base, ...fabMode };
   });
}
