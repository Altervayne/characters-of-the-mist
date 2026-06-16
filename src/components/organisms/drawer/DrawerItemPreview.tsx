// -- React Imports --
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Folder, GripVertical } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { resolveCardComponent } from '@/components/organisms/cards/resolveCardComponent';
import { StatusTrackerCard } from '@/components/organisms/trackers/StatusTracker';
import { StoryTagTrackerCard } from '@/components/organisms/trackers/StoryTagTracker';
import { CharacterSheetPreview } from '@/components/molecules/CharacterSheetPreview';
import { StoryThemeTrackerCard } from '@/components/organisms/trackers/StoryThemeTracker';

// -- Type Imports --
import type { DrawerItem, Folder as FolderType } from '@/lib/types/drawer';



export function FolderPreview({ folder }: { folder: FolderType }) {
   return (
      <div
            className="flex items-center justify-between gap-2 py-1 pl-1 pr-2 rounded bg-popover/50 border-2 border-border"
         >
         <div
            className="flex h-8 items-center gap-2 truncate "
         >
            <GripVertical
               className="h-5 w-5 shrink-0 text-accent-foreground cursor-grab"
            />
            <Folder className="h-6 w-6 shrink-0 text-accent-foreground"/>
            <span className="truncate font-medium text-sm">{folder.name}</span>
         </div>
      </div>
   );
}

/**
 * Static preview card for a drawer item: name, a non-interactive snapshot of the
 * stored content, and the game/type label.
 *
 * @param item - The drawer item to preview.
 * @param headerAction - Optional control rendered on the title row (e.g. the
 *   mobile context-menu button), so it reads as a corner action of this card
 *   rather than floating in a separate column beside it. Desktop and drag-overlay
 *   callers omit it and the title row keeps its original single-element layout.
 * @param headerActionLeft - Places `headerAction` on the left of the title
 *   instead of the right, to follow left-handed placement on mobile.
 */
export function DrawerItemPreview({
   item,
   headerAction,
   headerActionLeft = false,
}: {
   item: DrawerItem;
   headerAction?: ReactNode;
   headerActionLeft?: boolean;
}) {
   const { t } = useTranslation();

   const renderSnapshot = () => {
      const { content, type, game } = item;

      // Only Legends, City, and Otherscape items have previews; the card mapping
      // is delegated to resolveCardComponent, while trackers and full sheets are
      // game-independent. Anything outside these games falls through to the
      // unavailable-preview placeholder below.
      if (game === 'LEGENDS' || game === 'CITY_OF_MIST' || game === 'OTHERSCAPE') {
         if ('cardType' in content) {
            const Component = resolveCardComponent(type, game);
            if (Component) {
               return <Component card={content} isDrawerPreview />;
            }
         }

         if ('trackerType' in content) {
            if (content.trackerType === 'STATUS') {
               return <StatusTrackerCard tracker={content} isDrawerPreview />;
            }
            if (content.trackerType === 'STORY_TAG') {
               return <StoryTagTrackerCard tracker={content} isDrawerPreview />;
            }
            if (content.trackerType === 'STORY_THEME') {
               return <StoryThemeTrackerCard tracker={content} isDrawerPreview />;
            }
         }

         if (type === 'FULL_CHARACTER_SHEET') {
            return <CharacterSheetPreview item={item} />;
         }
      }

      return (
         <div className="w-62.5 h-25 flex items-center justify-center bg-popover/50 text-muted-foreground rounded-lg p-4 text-center">
               <p className="text-xs">{t('Drawer.Types.unavailablePreview')}</p>
         </div>
      );
   };

   return (
      <div className="p-2 rounded-md hover:bg-muted transition-colors bg-card/75 border-2 border-border">
         <div className={cn(
            "flex items-center gap-2 mb-2",
            headerActionLeft && "flex-row-reverse"
         )}>
            <p className="flex-1 min-w-0 font-semibold truncate text-md px-1">
               {item.name}
            </p>
            {headerAction}
         </div>

         <div className="w-full h-30 my-4 flex items-center justify-center bg-transparent pointer-events-none rounded-md overflow-hidden">
            <div>
               {renderSnapshot()}
            </div>
         </div>

         <p className="w-full text-center font-semibold truncate text-sm mb-2 px-1">
            <span>{t(`Drawer.Types.${item.game}`)}</span> • <span>{t(`Drawer.Types.${item.game}_${item.type}`)}</span>
         </p>
      </div>
   );
};