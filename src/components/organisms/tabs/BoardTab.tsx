// -- React Imports --
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';

// -- Icon Imports --
import { LayoutGrid } from 'lucide-react';

// -- Component Imports --
import { TabShell } from './TabShell';
import { CloseTabDialog } from '@/components/organisms/dialogs/CloseTabDialog';

// -- Store Imports --
import { getOrCreateBoardInstance } from '@/lib/board/boardStoreRegistry';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';

// -- Type Imports --
import type { OpenTab } from '@/lib/character/tabManagerStore';

/**
 * A board tab. Its label is live-bound to that board's OWN store instance from the
 * board registry (never the character registry - a board id would mint a junk character
 * instance). It shows a board icon rather than a game crest.
 *
 * Closing is destructive: a board is not drawer-saveable yet (board-8), so `closeTab`
 * deletes the board record "for good". Closing therefore ALWAYS confirms first.
 *
 * @param props.tab - The tab descriptor (its `id` is the board id keying the board store).
 * @param props.isActive - Whether this tab is the active one (drives the highlight).
 */
export function BoardTab({ tab, isActive }: { tab: OpenTab; isActive: boolean }) {
   const { t } = useTranslation();
   const { setActiveTab, closeTab } = useTabManagerActions();

   const instance = useMemo(() => getOrCreateBoardInstance(tab.id), [tab.id]);
   const name = useStore(instance, (state) => state.name);
   const label = name && name.trim().length > 0 ? name : t('Tabs.untitledBoard');

   const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);

   const icon = (
      <span
         aria-hidden
         className="flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-white/25 bg-gradient-to-br from-sky-500 to-indigo-600"
      >
         <LayoutGrid className="h-4 w-4 text-white" />
      </span>
   );

   return (
      <>
         <TabShell
            tabId={tab.id}
            label={label}
            leadingIcon={icon}
            isActive={isActive}
            onActivate={() => setActiveTab(tab.id)}
            onRequestClose={() => setIsCloseDialogOpen(true)}
         />
         <CloseTabDialog
            isOpen={isCloseDialogOpen}
            onOpenChange={setIsCloseDialogOpen}
            name={label}
            variant="board"
            onConfirm={() => closeTab(tab.id)}
         />
      </>
   );
}
