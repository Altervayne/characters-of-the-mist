// -- React Imports --
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Store Imports --
import { useCharacterActions, useCharacterStore } from '@/lib/stores/characterStore';

// -- Utils Imports --
import { applyStatusTier } from '@/lib/trackers/applyStatusTier';

// -- Type Imports --
import type { MentionSegment } from '@/lib/challenge/parseMentions';
import type { StatusTracker, StoryTagTracker } from '@/lib/types/character';

/*
 * The shared on-sheet handler for a tapped `{mention}`: it applies to the ACTIVE character (resolved by the
 * character-store hooks via ActiveCharacterStoreContext), so every sheet surface that authors mentions - the
 * challenge card and the sheet journal - creates on the same character from ONE source. A `{name-tier}`
 * status create-or-RAISES (bubble-up via `applyStatusTier`, no duplicate name); a `{tag}` add de-dupes by
 * name. Distinct from `useBoardMentionMint`, which mints board-native trackers through the board store.
 */

/** The character trackers the create-or-raise reads, and the actions it dispatches through. */
interface MentionTrackers {
   statuses: StatusTracker[];
   storyTags: StoryTagTracker[];
}
interface MentionActions {
   addStatus: (name?: string) => string;
   updateStatus: (trackerId: string, updates: Partial<StatusTracker>) => void;
   addStoryTag: (name?: string) => void;
}

/** How a mention resolved, so the caller can toast the matching message. */
export type MentionOutcome =
   | { kind: 'status-created'; name: string }
   | { kind: 'status-raised'; name: string }
   | { kind: 'tag-created'; name: string }
   | { kind: 'tag-exists'; name: string }
   | { kind: 'none' };

/**
 * Pure create-or-raise against the active character's trackers: a status create-or-RAISES (bubble-up by
 * name via `applyStatusTier`, no duplicate); a tag de-dupes by name. Dispatches through `actions` and
 * returns the outcome so the React layer owns the (side-effecting) toast. Kept framework-free so it is
 * unit-testable against a real store.
 */
export function applyMentionToCharacter(segment: MentionSegment, trackers: MentionTrackers, actions: MentionActions): MentionOutcome {
   if (segment.type === 'status') {
      const wanted = segment.name.trim().toLowerCase();
      const existing = trackers.statuses.find((status) => status.name.trim().toLowerCase() === wanted);
      if (existing) {
         actions.updateStatus(existing.id, { tiers: applyStatusTier(existing.tiers, segment.tier) });
         return { kind: 'status-raised', name: segment.name };
      }
      const id = actions.addStatus(segment.name);
      actions.updateStatus(id, { tiers: applyStatusTier(Array(6).fill(false), segment.tier) });
      return { kind: 'status-created', name: segment.name };
   }
   if (segment.type === 'tag') {
      const wanted = segment.name.trim().toLowerCase();
      if (trackers.storyTags.some((tag) => tag.name.trim().toLowerCase() === wanted)) {
         return { kind: 'tag-exists', name: segment.name };
      }
      actions.addStoryTag(segment.name);
      return { kind: 'tag-created', name: segment.name };
   }
   return { kind: 'none' };
}

export function useSheetMentionCreate(): (segment: MentionSegment) => void {
   const { t } = useTranslation();
   const actions = useCharacterActions();
   const character = useCharacterStore((state) => state.character);

   return useCallback((segment: MentionSegment) => {
      if (!character) return;
      const outcome = applyMentionToCharacter(segment, character.trackers, actions);
      switch (outcome.kind) {
         case 'status-raised':
            toast.success(t('Cards.challenge.mention.raised', { name: outcome.name }));
            break;
         case 'status-created':
         case 'tag-created':
            toast.success(t('Cards.challenge.mention.applied', { name: outcome.name }));
            break;
         case 'tag-exists':
            toast(t('Cards.challenge.mention.alreadyExists', { name: outcome.name }));
            break;
      }
   }, [actions, character, t]);
}
