// -- React Imports --
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';

// -- Icon Imports --
import { X } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Store Imports --
import { getOrCreateInstance } from '@/lib/character/characterStoreRegistry';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';

// -- Type Imports --
import type { OpenTab } from '@/lib/character/tabManagerStore';

/**
 * A single tab in the desktop {@link import('./TabStrip').TabStrip}. Its label is
 * live-bound to that tab's OWN store instance (not the active one), so a rename in
 * the sheet updates the tab immediately and a background tab shows its own name. The
 * instance is resolved once per tab id (idempotent + memoized) so the subscription is
 * stable and no instance is re-created on render.
 *
 * @param props.tab - The tab descriptor (its `id` keys the store instance).
 * @param props.isActive - Whether this tab is the active one (drives the highlight).
 */
export function Tab({ tab, isActive }: { tab: OpenTab; isActive: boolean }) {
   const { t } = useTranslation();
   const { setActiveTab, closeTab } = useTabManagerActions();

   const instance = useMemo(() => getOrCreateInstance(tab.id), [tab.id]);
   const name = useStore(instance, (state) => state.character?.name);
   const label = name && name.trim().length > 0 ? name : t('Tabs.untitled');

   return (
      <div
         className={cn(
            'group flex shrink-0 items-center gap-1 border-r border-border pl-3 pr-1 max-w-[12rem]',
            isActive ? 'bg-background' : 'bg-muted/40 hover:bg-muted/70',
         )}
      >
         <button
            type="button"
            onClick={() => setActiveTab(tab.id)}
            title={label}
            className={cn(
               'min-w-0 flex-1 truncate py-2 text-sm cursor-pointer text-left',
               isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
         >
            {label}
         </button>
         <button
            type="button"
            onClick={() => closeTab(tab.id)}
            aria-label={t('Tabs.closeTab')}
            className="shrink-0 rounded p-1 text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground hover:opacity-100 cursor-pointer"
         >
            <X className="h-3.5 w-3.5" />
         </button>
      </div>
   );
}
