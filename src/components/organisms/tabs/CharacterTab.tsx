// -- React Imports --
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { TabShell } from './TabShell';
import { CloseTabDialog } from '@/components/organisms/dialogs/CloseTabDialog';

// -- Store Imports --
import { getOrCreateInstance } from '@/lib/character/characterStoreRegistry';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';

// -- Constants --
import { getGameVisual } from '@/lib/constants/gameVisuals';

// -- Type Imports --
import type { OpenTab } from '@/lib/character/tabManagerStore';

/**
 * A character tab. Its label and game crest are live-bound to that character's OWN
 * store instance (not the active one), so a rename in the sheet updates the tab
 * immediately and a background tab shows its own name. Closing deletes the working
 * record, so a dirty tab confirms first; a clean tab closes silently.
 *
 * @param props.tab - The tab descriptor (its `id` keys the character store instance).
 * @param props.isActive - Whether this tab is the active one (drives the highlight).
 */
export function CharacterTab({ tab, isActive }: { tab: OpenTab; isActive: boolean }) {
   const { t } = useTranslation();
   const { setActiveTab, closeTab } = useTabManagerActions();

   const instance = useMemo(() => getOrCreateInstance(tab.id), [tab.id]);
   const name = useStore(instance, (state) => state.character?.name);
   const game = useStore(instance, (state) => state.character?.game);
   const hasUnsavedChanges = useStore(instance, (state) => state.hasUnsavedChanges);
   const label = name && name.trim().length > 0 ? name : t('Tabs.untitled');

   const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
   const handleRequestClose = () => {
      if (hasUnsavedChanges) setIsCloseDialogOpen(true);
      else closeTab(tab.id);
   };

   // Left game crest: a centered, rounded, gradient-filled square with a white icon
   // and a subtle inner ring (a neutral placeholder when the game is unavailable).
   const gameVisual = getGameVisual(game);
   const GameIcon = gameVisual.Icon;
   const crest = (
      <span
         aria-hidden
         className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-white/25',
            gameVisual.gradient,
         )}
      >
         <GameIcon className="h-4 w-4 text-white" />
      </span>
   );

   return (
      <>
         <TabShell
            tabId={tab.id}
            label={label}
            leadingIcon={crest}
            isActive={isActive}
            onActivate={() => setActiveTab(tab.id)}
            onRequestClose={handleRequestClose}
         />
         <CloseTabDialog
            isOpen={isCloseDialogOpen}
            onOpenChange={setIsCloseDialogOpen}
            name={label}
            onConfirm={() => closeTab(tab.id)}
         />
      </>
   );
}
