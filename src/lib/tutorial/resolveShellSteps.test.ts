// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { resolveShellSteps } from './resolveShellSteps';
import type { TutorialDefinition, TutorialStep } from './tutorialTypes';

/*
 * The nav-shell step resolution: the FAB ring exposes different controls than the bottom bar, so a beat may
 * override its anchor / copy / arrival for that shell only, or belong to one shell outright. A beat with
 * neither, and every desktop tour, must come through byte-for-byte - and the result has to be safe to
 * memoize on the shell flag alone. Each shell also has to end up with its own step count, since that is what
 * the coach-mark's progress rail reads.
 */

function definitionOf(steps: TutorialStep[]): TutorialDefinition {
   return {
      id: 'test.tutorial',
      platform: 'mobile',
      system: 'navigation',
      titleKey: 'title',
      teachKey: 'teach',
      steps,
   };
}

const plain: TutorialStep = {
   id: 'plain',
   anchorKey: 'shared-anchor',
   titleKey: 'plain_title',
   bodyKey: 'plain_body',
   advance: { on: 'next-click' },
};

const ringOnly: TutorialStep = {
   id: 'ring-only',
   anchorKey: 'ring-control',
   titleKey: 'ringOnly_title',
   bodyKey: 'ringOnly_body',
   advance: { on: 'next-click' },
   shell: 'fab',
};

const branching: TutorialStep = {
   id: 'branching',
   anchorKey: 'bar-anchor',
   titleKey: 'branching_title',
   bodyKey: 'branching_body',
   placement: 'top',
   advance: { on: 'next-click' },
   fabMode: {
      anchorKey: 'ring-anchor',
      bodyKey: 'branching_body_fab',
      placement: 'center',
   },
};

describe('resolveShellSteps', () => {
   it('returns nothing without a definition', () => {
      expect(resolveShellSteps(null, false)).toEqual([]);
      expect(resolveShellSteps(null, true)).toEqual([]);
   });

   it('passes a definition with no overrides through untouched in either shell', () => {
      const definition = definitionOf([plain]);
      expect(resolveShellSteps(definition, false)).toBe(definition.steps);
      // The FAB branch maps, but an override-free beat keeps its identity, so nothing re-renders on it.
      expect(resolveShellSteps(definition, true)[0]).toBe(plain);
   });

   it('leaves a branching beat alone in the bottom-bar shell', () => {
      const definition = definitionOf([plain, branching]);
      expect(resolveShellSteps(definition, false)[1]).toBe(branching);
   });

   it('applies the overrides and drops the key in the FAB shell', () => {
      const [, resolved] = resolveShellSteps(definitionOf([plain, branching]), true);
      expect(resolved).toEqual({
         id: 'branching',
         anchorKey: 'ring-anchor',
         titleKey: 'branching_title',
         bodyKey: 'branching_body_fab',
         placement: 'center',
         advance: { on: 'next-click' },
      });
      expect('fabMode' in resolved).toBe(false);
   });

   it('lets an override clear an anchor, so a beat with nothing to point at goes centred', () => {
      const anchorless: TutorialStep = { ...branching, fabMode: { anchorKey: undefined, placement: 'center' } };
      const [resolved] = resolveShellSteps(definitionOf([anchorless]), true);
      expect(resolved.anchorKey).toBeUndefined();
      expect(resolved.placement).toBe('center');
   });

   it('keeps a shell-scoped beat only in the shell it belongs to', () => {
      const definition = definitionOf([plain, ringOnly, branching]);
      expect(resolveShellSteps(definition, true).map((step) => step.id)).toEqual(['plain', 'ring-only', 'branching']);
      expect(resolveShellSteps(definition, false).map((step) => step.id)).toEqual(['plain', 'branching']);
   });

   it('gives each shell its own step count and indices', () => {
      const barOnly: TutorialStep = { ...plain, id: 'bar-only', shell: 'navbar' };
      const definition = definitionOf([plain, ringOnly, barOnly, branching]);
      // Four authored beats, three in each shell: the count and the indices are the shell's own, never a blend.
      expect(resolveShellSteps(definition, true).map((step) => step.id)).toEqual(['plain', 'ring-only', 'branching']);
      expect(resolveShellSteps(definition, false).map((step) => step.id)).toEqual(['plain', 'bar-only', 'branching']);
   });

   it('leaves an unscoped definition whole in both shells', () => {
      const definition = definitionOf([plain, branching]);
      expect(resolveShellSteps(definition, false)).toBe(definition.steps);
      expect(resolveShellSteps(definition, true)).toHaveLength(2);
   });

   it('never mutates the authored definition', () => {
      const definition = definitionOf([branching]);
      resolveShellSteps(definition, true);
      expect(definition.steps[0]).toEqual(branching);
   });
});
