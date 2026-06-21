// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { StatusTrackerCard } from '@/components/organisms/trackers/StatusTracker';
import { StoryTagTrackerCard } from '@/components/organisms/trackers/StoryTagTracker';
import { StoryThemeTrackerCard } from '@/components/organisms/trackers/StoryThemeTracker';
import { EmbeddedFallback } from './BoardCardItem';

// -- Type Imports --
import type { TrackerBoardContent } from '@/lib/types/board';
import type { Tracker } from '@/lib/types/character';

/*
 * Renders an embedded drawer TRACKER on the board, as the real tracker component in its
 * compact snapshot form (`isDrawerPreview`). Read-only; reads from the board item's
 * copied data, so it never touches the character context.
 */
export function BoardTrackerItem({ content }: { content: TrackerBoardContent }) {
   const { t } = useTranslation();

   if (content.mode !== 'copy') return <EmbeddedFallback label={t('BoardView.embeddedUnavailable')} />;

   const tracker = content.data as Tracker;
   const body =
      tracker.trackerType === 'STATUS' ? <StatusTrackerCard tracker={tracker} isDrawerPreview /> :
      tracker.trackerType === 'STORY_TAG' ? <StoryTagTrackerCard tracker={tracker} isDrawerPreview /> :
      tracker.trackerType === 'STORY_THEME' ? <StoryThemeTrackerCard tracker={tracker} isDrawerPreview /> :
      null;

   if (!body) return <EmbeddedFallback label={t('BoardView.embeddedUnavailable')} />;

   return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden bg-card pointer-events-none">
         {body}
      </div>
   );
}
