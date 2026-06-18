// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Plus } from 'lucide-react';

// -- Component Imports --
import { Tab } from './Tab';
import { NewTabDialog } from '@/components/organisms/dialogs/NewTabDialog';

// -- Store Imports --
import { useTabManagerStore } from '@/lib/character/tabManagerStore';

/**
 * Desktop multi-character tab strip (tabs spec §5): a top bar over the character
 * area, to the right of the SidebarMenu. Renders the open tabs in order with a
 * trailing `+` that opens the {@link NewTabDialog}. Overflow scrolls horizontally
 * (drag-to-reorder and overflow polish are Phase 4). At zero open tabs the strip
 * shows just the `+` and the area below renders the MainMenu.
 *
 * Mobile does not render this strip (it stays single-character).
 */
export function TabStrip() {
   const { t } = useTranslation();
   const openTabs = useTabManagerStore((state) => state.openTabs);
   const activeTabId = useTabManagerStore((state) => state.activeTabId);
   const [isNewTabDialogOpen, setIsNewTabDialogOpen] = useState(false);

   return (
      <div className="flex shrink-0 items-stretch border-b-2 border-border bg-card overflow-x-auto overscroll-x-contain">
         {openTabs.map((tab) => (
            <Tab key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
         ))}

         <button
            type="button"
            onClick={() => setIsNewTabDialogOpen(true)}
            aria-label={t('Tabs.newTab')}
            title={t('Tabs.newTab')}
            className="shrink-0 flex items-center justify-center px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
         >
            <Plus className="h-4 w-4" />
         </button>

         <NewTabDialog isOpen={isNewTabDialogOpen} onOpenChange={setIsNewTabDialogOpen} />
      </div>
   );
}
