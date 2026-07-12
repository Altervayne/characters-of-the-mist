// -- React Imports --
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';

// -- Icon Imports --
import { ArrowLeft, ChevronRight, LayoutGrid, NotebookPen, User, type LucideIcon } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Portals Imports --
import { openEntityTab } from '@/lib/portals/openEntityTab';

// -- Store Imports --
import { useTabManagerActions, useTabManagerStore } from '@/lib/character/tabManagerStore';
import { deriveCurrentIndex } from '@/lib/character/journey';

// -- Type Imports --
import type { TabType } from '@/lib/character/tabManagerStore';

/*
 * The PORTAL TRAIL: a floating breadcrumb pill showing the back-stack of portal navigations, so a GM can see
 * where a dive took them and step back out. It is deliberately DISTINCT from the always-present tab strip: it
 * appears ONLY during a dive (>= 2 entries) - "shows up only on a journey" is the primary anti-conflation signal
 * - and it reads as directed HISTORY (a leading Back arrow, `>`-chevron crumbs, the current one highlighted, not
 * closeable), never as peer tabs.
 *
 * Navigation reactivates through `openEntityTab` (which reopens a closed-but-SAVED target by id - never a raw
 * `setActiveTab`, which no-ops off-strip), so its `openTabs`-first-then-drawer resolve is the liveness oracle.
 * A truly-dead entry (closed AND never-saved) is detected AT the pop: it toasts and drops, and Back keeps
 * stepping over it. Desktop-only (it mounts in the desktop workspace; boards/portals never render on mobile).
 */

/** The crumb glyph per tab kind (mirrors the tab strip's own icons). */
const KIND_ICON: Record<TabType, LucideIcon> = { board: LayoutGrid, note: NotebookPen, character: User };

/** The untitled fallback key per tab kind, for a crumb whose snapshot name was empty. */
const KIND_UNTITLED: Record<TabType, string> = {
   board: 'Tabs.untitledBoard',
   note: 'Tabs.untitledNote',
   character: 'Tabs.untitled',
};

export function PortalTrailPill() {
   const { t } = useTranslation();
   const reduce = useReducedMotion() ?? false;
   const actions = useTabManagerActions();

   const entries = useTabManagerStore((state) => state.journey.entries);
   const currentIndex = useTabManagerStore((state) => state.journey.currentIndex);
   const activeTabId = useTabManagerStore((state) => state.activeTabId);

   // The highlighted crumb: the active tab's entry when it is on-trail (the marker follows it), else none - the
   // dive is paused because the user wandered off it via the tab strip (owner-locked "intact-but-paused").
   const activeIndex = deriveCurrentIndex({ entries, currentIndex }, activeTabId);
   // Back / step-from position: the highlighted crumb when on-trail, else the stored marker (resume the dive).
   const effectiveIndex = activeIndex ?? currentIndex;

   /** Reactivates one entry; on a dead target toasts + drops it. Returns whether the tab opened. */
   const reactivate = useCallback(
      async (tabKind: TabType, entityId: string): Promise<boolean> => {
         let missed = false;
         await openEntityTab(tabKind, entityId, { actions, onMissing: () => { missed = true; } });
         if (missed) {
            toast.error(t('Notifications.link.targetNotFound'));
            actions.dropJourneyEntry(entityId);
            return false;
         }
         return true;
      },
      [actions, t],
   );

   /** Back: sync the marker to the effective position, then step back over any dead entries to the first live one. */
   const goBack = useCallback(async () => {
      actions.goToJourneyIndex(effectiveIndex);
      // Bounded by the trail length: each miss drops an entry, so the loop always terminates.
      for (let guard = useTabManagerStore.getState().journey.entries.length + 1; guard > 0; guard--) {
         const entry = actions.journeyBack();
         if (!entry) return;
         if (await reactivate(entry.tabKind, entry.entityId)) return;
      }
   }, [actions, effectiveIndex, reactivate]);

   /** Crumb click (including a forward crumb): jump the marker there and reactivate; a dead crumb toasts + drops. */
   const goToIndex = useCallback(
      async (index: number) => {
         const entry = actions.goToJourneyIndex(index);
         if (entry) await reactivate(entry.tabKind, entry.entityId);
      },
      [actions, reactivate],
   );

   // Shown ONLY during a dive: the appearance itself is the strongest "this is not the tab strip" tell.
   if (entries.length < 2) return null;

   return (
      <motion.nav
         aria-label={t('Tabs.portalTrail')}
         initial={reduce ? false : { opacity: 0, y: -6 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
         className="pointer-events-auto absolute left-1/2 top-2 z-30 flex max-w-[min(90%,44rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/95 px-2 py-1 text-sm shadow-md backdrop-blur-sm"
      >
         <button
            type="button"
            onClick={goBack}
            disabled={effectiveIndex <= 0}
            aria-label={t('Tabs.portalTrailBack')}
            title={t('Tabs.portalTrailBack')}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
         >
            <ArrowLeft className="h-4 w-4" />
         </button>

         <ol className="flex min-w-0 items-center gap-0.5">
            {entries.map((entry, index) => {
               const Icon = KIND_ICON[entry.tabKind];
               const label = entry.name.trim().length > 0 ? entry.name : t(KIND_UNTITLED[entry.tabKind]);
               const isCurrent = index === activeIndex;
               return (
                  <li key={index} className="flex min-w-0 items-center gap-0.5">
                     {index > 0 && <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                     <button
                        type="button"
                        onClick={() => void goToIndex(index)}
                        title={label}
                        aria-current={isCurrent ? 'true' : undefined}
                        className={cn(
                           'flex min-w-0 items-center gap-1 rounded-full px-2 py-0.5 cursor-pointer',
                           isCurrent
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                     >
                        <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 truncate">{label}</span>
                     </button>
                  </li>
               );
            })}
         </ol>
      </motion.nav>
   );
}
