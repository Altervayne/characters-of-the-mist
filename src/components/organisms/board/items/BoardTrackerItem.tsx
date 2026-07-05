// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { StatusTrackerCard } from '@/components/organisms/trackers/StatusTracker';
import { StoryTagTrackerCard } from '@/components/organisms/trackers/StoryTagTracker';
import { StoryThemeTrackerCard } from '@/components/organisms/trackers/StoryThemeTracker';
import { EmbeddedItem, EmbeddedFallback } from './EmbeddedItem';
import { InteractiveEmbed } from './InteractiveEmbed';

// -- Board Imports --
import type { EmbedSlot } from '@/lib/board/useEmbedCharacterStore';

// -- Type Imports --
import type { BoardItem, BoardItemContent, TrackerBoardContent } from '@/lib/types/board';
import type { Tracker } from '@/lib/types/character';

/*
 * An embedded drawer TRACKER on the board. Copy/reference machinery lives in {@link EmbeddedItem}:
 * a reference renders the read-only live snapshot; a COPY renders the real tracker live and
 * editable via {@link InteractiveEmbed} (its own per-embed character store), with edits committed
 * back to `content.data`.
 */
interface BoardTrackerItemProps {
   item: BoardItem;
   content: TrackerBoardContent;
   isSelected: boolean;
   /** The selection toolbar's per-kind slot (the interactive copy's Edit toggle portals here). */
   toolbarSlot: HTMLElement | null;
   onContentChange: (content: BoardItemContent) => void;
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   /** Adopts a Save-As drawer id onto the copy's source link via a direct (non-undoable) write. */
   onAdoptSource: (id: string, sourceDrawerItemId: string) => void;
   onDelete: (id: string) => void;
}

/** The synthetic-character slot a tracker lives in, by its type. */
function trackerSlot(tracker: Tracker): EmbedSlot {
   if (tracker.trackerType === 'STATUS') return 'statuses';
   if (tracker.trackerType === 'STORY_TAG') return 'storyTags';
   return 'storyThemes';
}

export function BoardTrackerItem({ item, content, isSelected, toolbarSlot, onContentChange, onCacheLastKnown, onAdoptSource, onDelete }: BoardTrackerItemProps) {
   return (
      <EmbeddedItem
         item={item}
         content={content}
         isSelected={isSelected}
         toolbarSlot={toolbarSlot}
         onContentChange={onContentChange}
         onCacheLastKnown={onCacheLastKnown}
         onAdoptSource={onAdoptSource}
         onDelete={onDelete}
         renderSnapshot={(data) => <TrackerSnapshot data={data} />}
         renderInteractive={({ data, isSelected, toolbarSlot, onCommit }) => (
            <InteractiveEmbed
               slot={trackerSlot(data as Tracker)}
               data={data}
               isSelected={isSelected}
               toolbarSlot={toolbarSlot}
               onCommit={onCommit}
               render={(live, isEditing) => <InteractiveTracker tracker={live as Tracker} isEditing={isEditing} />}
            />
         )}
      />
   );
}

/** Renders a tracker as its real component, live and interactive (board-embed mode). */
function InteractiveTracker({ tracker, isEditing }: { tracker: Tracker; isEditing: boolean }) {
   const { t } = useTranslation();
   if (tracker.trackerType === 'STATUS') return <StatusTrackerCard tracker={tracker} isBoardEmbed isEditing={isEditing} />;
   if (tracker.trackerType === 'STORY_TAG') return <StoryTagTrackerCard tracker={tracker} isBoardEmbed isEditing={isEditing} />;
   if (tracker.trackerType === 'STORY_THEME') return <StoryThemeTrackerCard tracker={tracker} isBoardEmbed isEditing={isEditing} />;
   return <EmbeddedFallback label={t('BoardView.embeddedUnavailable')} />;
}

/** Renders a tracker (reference live content) as its real component, read-only. */
function TrackerSnapshot({ data }: { data: unknown }) {
   const { t } = useTranslation();
   const tracker = data as Tracker;
   if (tracker.trackerType === 'STATUS') return <StatusTrackerCard tracker={tracker} isDrawerPreview />;
   if (tracker.trackerType === 'STORY_TAG') return <StoryTagTrackerCard tracker={tracker} isDrawerPreview />;
   if (tracker.trackerType === 'STORY_THEME') return <StoryThemeTrackerCard tracker={tracker} isDrawerPreview />;
   return <EmbeddedFallback label={t('BoardView.embeddedUnavailable')} />;
}
