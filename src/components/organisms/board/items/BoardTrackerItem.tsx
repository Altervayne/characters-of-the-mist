// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { StatusTrackerCard } from '@/components/organisms/trackers/StatusTracker';
import { StoryTagTrackerCard } from '@/components/organisms/trackers/StoryTagTracker';
import { StoryThemeTrackerCard } from '@/components/organisms/trackers/StoryThemeTracker';
import { EmbeddedItem, EmbeddedFallback } from './EmbeddedItem';

// -- Type Imports --
import type { BoardItem, BoardItemContent, TrackerBoardContent } from '@/lib/types/board';
import type { Tracker } from '@/lib/types/character';

/*
 * An embedded drawer TRACKER on the board. Copy/reference machinery lives in
 * {@link EmbeddedItem}; this just supplies the tracker snapshot render.
 */
interface BoardTrackerItemProps {
   item: BoardItem;
   content: TrackerBoardContent;
   isSelected: boolean;
   onContentChange: (content: BoardItemContent) => void;
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   onDelete: (id: string) => void;
}

export function BoardTrackerItem({ item, content, isSelected, onContentChange, onCacheLastKnown, onDelete }: BoardTrackerItemProps) {
   return (
      <EmbeddedItem
         item={item}
         content={content}
         isSelected={isSelected}
         onContentChange={onContentChange}
         onCacheLastKnown={onCacheLastKnown}
         onDelete={onDelete}
         renderSnapshot={(data) => <TrackerSnapshot data={data} />}
      />
   );
}

/** Renders a tracker (copy data or live reference content) as its real component. */
function TrackerSnapshot({ data }: { data: unknown }) {
   const { t } = useTranslation();
   const tracker = data as Tracker;
   if (tracker.trackerType === 'STATUS') return <StatusTrackerCard tracker={tracker} isDrawerPreview />;
   if (tracker.trackerType === 'STORY_TAG') return <StoryTagTrackerCard tracker={tracker} isDrawerPreview />;
   if (tracker.trackerType === 'STORY_THEME') return <StoryThemeTrackerCard tracker={tracker} isDrawerPreview />;
   return <EmbeddedFallback label={t('BoardView.embeddedUnavailable')} />;
}
