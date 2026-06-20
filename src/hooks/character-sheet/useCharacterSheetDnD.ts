// -- React Imports --
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';
import cuid from 'cuid';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';

// -- Utils Imports --
import { mapItemToStorableInfo } from '@/lib/utils/dnd';
import { MORPH_DESCRIPTORS, SPRING_BACK_KEY, computeReorderTargetIndex, createSpringController, deriveDragContext, drawerDropTargetKey, isOverTabLaneFor, resolveDrawerDropTarget, resolveInsertPosition, resolveSpringTarget, resolveTabSpringTarget, shouldForceMorph, springDirection } from '@/lib/utils/dragFeedback';
import { sheetSectionForItemType } from '@/lib/utils/dnd';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- Drag-morph engine --
import { useDragMorph } from '@/components/molecules/drag-morph/useDragMorph';
import { buildDragIdentity } from '@/hooks/character-sheet/buildDragIdentity';

// -- Store Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useTabManagerActions, useTabManagerStore } from '@/lib/character/tabManagerStore';
import { getOrCreateInstance } from '@/lib/character/characterStoreRegistry';
import { useDrawerStore, useDrawerActions } from '@/lib/stores/drawerStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

// -- Type Imports --
import type { Character, Card as CardData, Tracker } from '@/lib/types/character';
import type { DrawerItem, Folder as FolderType } from '@/lib/types/drawer';
import type { OpenTab } from '@/lib/character/tabManagerStore';
import type { DragContext, DragKind, DragOverZone, DrawerDropTarget, ReorderIndicator, ReorderListId, SpringController, SpringHitArea, SpringTarget } from '@/lib/utils/dragFeedback';



/**
 * How far (px) the cursor must move after a spring navigation before in-drawer folder
 * rows are honored as drop targets again. Within this grace the drop target is forced
 * to the current folder, so a row that merely reflowed under the stationary cursor
 * (e.g. at root, where the Back button vanishes) is never an accidental target.
 */
const NAV_GRACE_PX = 24;

/**
 * Classifies a drag's source ONCE at start, so the drag-scoped `pointermove`
 * listener can branch (tab-lane test, puck context) by kind without re-reading
 * @dnd-kit's active data on every move.
 *
 * @param active - The @dnd-kit `active` descriptor from `onDragStart`.
 * @returns The {@link DragKind}, or null when the source is not recognised.
 */
function classifyDrag(active: DragStartEvent['active']): DragKind {
   const type = active.data.current?.type as string | undefined;
   if (type === DRAG_TYPES.TAB) return 'tab';
   if (type === DRAG_TYPES.DRAWER_FOLDER) return 'drawer-folder';
   if (type === DRAG_TYPES.DRAWER_ITEM) {
      const item = active.data.current?.item as DrawerItem | undefined;
      return item?.type === 'FULL_CHARACTER_SHEET' ? 'drawer-character' : 'drawer-component';
   }
   if (typeof type === 'string' && type.startsWith('sheet-')) return 'sheet-item';
   return null;
}



/**
 * Owns the entire character-sheet drag-and-drop subsystem.
 *
 * Encapsulates the active drag item and hover state, the memoized SortableContext
 * id arrays, and the full set of @dnd-kit event handlers. `handleDragEnd` routes
 * every supported drop - drawer-to-sheet character loads and component imports,
 * sheet-to-drawer saves, in-drawer moves and reorders, and on-sheet reordering -
 * by inspecting the drag source and target and dispatching directly to the
 * character and drawer store actions. The page only forwards `handleDragStart`,
 * `handleDragOver`, and `handleDragEnd` to its `DndContext` and wires the returned
 * id arrays and drag state into its JSX.
 *
 * The three sheet drop zones (trackers, cards, main play area) are intentionally
 * NOT registered here: `useDroppable` only resolves against a `DndContext` when
 * it is called inside that context's subtree, and this hook runs in the page body
 * that renders the `DndContext` (so it is above it, not within). The zones
 * therefore self-register inside their descendant components (`TrackersSection`,
 * `CardsSection`, `SheetMainDropZone`).
 *
 * @returns The drag state, memoized id arrays, and the `DndContext` event
 *   handlers.
 */
export function useCharacterSheetDnD() {
   const { t: tNotifications } = useTranslation();

   const character = useCharacterStore((state) => state.character);
   const { reorderCards, reorderStatuses, reorderStoryTags, reorderStoryThemes,
            addImportedCard, addImportedTracker } = useCharacterActions();
   const { openCharacterTab, reorderTabs, setActiveTab } = useTabManagerActions();
   // The drawer renders a single folder at a time, so the loaded current-folder
   // view is the reorder scope for any in-drawer drag.
   const currentFolderView = useDrawerStore((state) => state.currentFolderView);
   const { initiateItemDrop, moveFolder, reorderFolders, moveItem, reorderItems, setDrawerCurrentFolderId } = useDrawerActions();
   const { setContextualGame } = useAppSettingsActions();
   const { setDrawerOpen } = useAppGeneralStateActions();

   // ==================
   //  Utility & Library States
   // ==================
   const [isOverDrawer, setIsOverDrawer] = useState(false);
   const [activeDragItem, setActiveDragItem] = useState<CardData | Tracker | DrawerItem | FolderType | null>(null);
   const [overDragId, setOverDragId] = useState<string | null>(null);
   // The tab being dragged (the strip shares this DndContext); drives the overlay's
   // tab-preview branch. Separate from `activeDragItem` since a tab is not a sheet item.
   const [activeTabDrag, setActiveTabDrag] = useState<OpenTab | null>(null);

   // Memoize SortableContext arrays to prevent unnecessary re-renders
   const statusIds = useMemo(
      () => character?.trackers.statuses.map(t => t.id) || [],
      [character?.trackers.statuses]
   );
   const storyTagIds = useMemo(
      () => character?.trackers.storyTags.map(t => t.id) || [],
      [character?.trackers.storyTags]
   );
   const storyThemeIds = useMemo(
      () => character?.trackers.storyThemes.map(t => t.id) || [],
      [character?.trackers.storyThemes]
   );
   const cardIds = useMemo(
      () => character?.cards.map(c => c.id) || [],
      [character?.cards]
   );

   // ==================
   //  Drag-feedback layer: context derivation + generous tab lane
   // ==================
   // `dragContext`/`isOverTabLane` are React state (feed the morph engine and the
   // strip highlight); their `*Ref` twins are the truth read inside `handleDragEnd`,
   // where the matching state can lag. `tabStripElRef` caches the strip element
   // (queried once at drag start) for the generous geometry test. The cursor itself
   // is positioned imperatively by the morph engine (see below), not here.
   const [dragContext, setDragContext] = useState<DragContext>(null);
   const [isOverTabLane, setIsOverTabLane] = useState(false);
   const tabStripElRef = useRef<HTMLElement | null>(null);
   const dragKindRef = useRef<DragKind>(null);
   const overZoneRef = useRef<DragOverZone>(null);
   const isOverTabLaneRef = useRef(false);
   const dragContextRef = useRef<DragContext>(null);
   // Force-morph: drawer items morph everywhere except the items area.
   const [forceMorph, setForceMorph] = useState(false);
   const forceMorphRef = useRef(false);
   // Which sheet section to highlight for a compatible drawer-item drag ('cards'/'trackers').
   const [sheetHighlight, setSheetHighlight] = useState<'cards' | 'trackers' | null>(null);
   // Whether the dragged item can actually land on the current sheet (game match).
   // Gates the 'add-to-sheet' glyph: no action possible → no glyph (still morphs).
   const sheetCompatibleRef = useRef(true);
   // Reactive flag for the whole drag of a game-incompatible component, driving the
   // large "can't drop here" overlay over the sheet (issue 5). Set once at drag start.
   const [isIncompatibleComponentDrag, setIsIncompatibleComponentDrag] = useState(false);
   // The character a dragged SHEET item came from, so a drop on a DIFFERENT tab's
   // sheet (after tab auto-nav) imports a copy rather than a no-op reorder.
   const dragSourceCharacterIdRef = useRef<string | null>(null);

   // ==================
   //  Drag-morph engine
   // ==================
   // The reusable overlay-feedback engine (funnel clone + cursor cluster). This hook
   // computes the signals (cursor, descriptor, spring) and feeds them in; the engine
   // owns only the visual choreography and knows nothing of drawers/tabs/navigation.
   const { captureGrab, setCursor, setMorph, setIdentity, reset: resetMorph, renderClone, renderCluster } = useDragMorph();

   // ==================
   //  Spring-loaded drawer navigation
   // ==================
   // Dwelling on a folder row / Back button mid-drag drills the drawer there without
   // ending the drag, so a deep move is one continuous gesture. `springTarget` (state)
   // drives the progress affordance on the hovered row; `draggedFolderIdRef` excludes
   // the held folder; `springNavigatingRef` guards against re-firing while a (async)
   // navigation is in flight. The controller owns the dwell timer (see dragFeedback).
   const [springTarget, setSpringTarget] = useState<string | null>(null);
   const draggedFolderIdRef = useRef<string | null>(null);
   const springNavigatingRef = useRef(false);
   // The in-drawer drop target under the cursor, resolved by live geometry each move.
   // dnd-kit's collision rects desync in the scrollable/animated
   // drawer so folder drops were center-only; this is the source of truth for an
   // in-drawer move at drop. Read at dragEnd (the dwell-then-release value is correct
   //, it holds the folder the spring drilled into). Cleared on end/cancel.
   const hoveredDrawerTargetRef = useRef<DrawerDropTarget | null>(null);
   // Reactive mirror of `hoveredDrawerTargetRef` for the drop INDICATORS:
   // the folder nest highlight + items-area highlight read this so the highlight matches
   // the full-row resolver drop, not dnd-kit's center-only `over`. Updated only when the
   // resolved target's key CHANGES (the ref stays the per-frame truth read at drop), and
   // scoped to resolver-driven drags (drawer moves), sheet/tab saves keep their dnd-kit
   // `over` indicator path so a center-only save never shows a full-row highlight.
   const [drawerDropTarget, setDrawerDropTarget] = useState<DrawerDropTarget | null>(null);
   const drawerDropTargetKeyRef = useRef<string | null>(null);
   // Single reorder insertion-line indicator. `reorderOverRef` caches the
   // current same-list reorder target (set in handleDragOver from dnd-kit's `over` + its
   // measured rect); `handlePointerMove` derives the before/after edge from the live cursor
   // each move and mirrors it into `reorderIndicator` state ONLY on a key change (so the
   // line re-renders when the row/edge changes, not per frame). Static layout keeps the
   // cached rect valid for the whole drag.
   const [reorderIndicator, setReorderIndicator] = useState<ReorderIndicator | null>(null);
   const reorderOverRef = useRef<{ listId: ReorderListId; overId: string; rect: { top: number; bottom: number; left: number; right: number }; axis: 'vertical' | 'horizontal' } | null>(null);
   const reorderIndicatorKeyRef = useRef<string | null>(null);
   // The latest resolved indicator, read at drop so the persisted reorder lands on the
   // exact edge the line showed (handleDragEnd is a stable callback; a ref avoids re-binding).
   const reorderIndicatorRef = useRef<ReorderIndicator | null>(null);
   // The live cursor each move, so a spring nav can anchor the post-nav grace below.
   const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
   // After a spring nav the view reflows under the STATIONARY cursor (e.g. at root the
   // Back button vanishes and a folder row slides up into the cursor), which would make
   // that folder an accidental drop target. While this anchor is set, the drop target is
   // forced to the current folder until the cursor genuinely moves away (the grace), so
   // a dwell-then-release lands in the folder you navigated to. Cleared on real movement.
   const navGraceAnchorRef = useRef<{ x: number; y: number } | null>(null);

   /**
    * Performs a spring navigation when a dwell completes: drill into a folder, or go
    * up via the parent (read fresh from the store so Back is never stale). Guards
    * against re-firing while a navigation is in flight; the next pointer move
    * re-derives the dwell against the freshly loaded view, chaining multi-level
    * drilling without ending the drag.
    */
   const handleSpringNavigate = useCallback((target: SpringTarget) => {
      // Tab auto-nav: spring-switch the active character (synchronous). The drag
      // stays alive via the shared DragOverlay; the next move re-evaluates against
      // the now-active tab's sheet.
      if (target.kind === 'tab') {
         setActiveTab(target.id);
         return;
      }
      if (springNavigatingRef.current) return;
      const destination = target.kind === 'back' ? useDrawerStore.getState().parentFolderId : target.id;
      // Anchor the post-nav grace at the current cursor: until it moves NAV_GRACE_PX,
      // the drop resolves to the folder we navigated to (not a row that reflows under it).
      navGraceAnchorRef.current = lastPointerRef.current;
      springNavigatingRef.current = true;
      // No post-nav target reset needed: dropping over the Back button (or anywhere in
      // the drawer that isn't a folder row) resolves to `current-folder`, which reads
      // the live current folder at drop, so a dwell-Back-then-release lands in the
      // folder you navigated to, regardless of pointer movement after the nav.
      void Promise.resolve(setDrawerCurrentFolderId(destination)).finally(() => {
         springNavigatingRef.current = false;
      });
   }, [setDrawerCurrentFolderId, setActiveTab]);

   // The dwell controller is an imperative object created once (in an effect, not
   // during render, so its ref-reading callback is allowed) and reused for the
   // hook's lifetime; the event handlers below drive it via the ref.
   const springControllerRef = useRef<SpringController | null>(null);
   useEffect(() => {
      springControllerRef.current = createSpringController({
         onTargetChange: setSpringTarget,
         onNavigate: handleSpringNavigate,
      });
      const controller = springControllerRef.current;
      return () => controller.cancel();
   }, [handleSpringNavigate]);

   // Feed the morph engine a single resolved signal whenever the derived context or
   // the spring target changes. The arrow mirrors springDirection() for
   // the active dwell; the engine renders, knowing nothing of what the action means.
   useEffect(() => {
      let springArrow = null as ReturnType<typeof springDirection> | null;
      if (springTarget != null) {
         const target: SpringTarget = springTarget === SPRING_BACK_KEY
            ? { kind: 'back' }
            : springTarget.startsWith('tab:')
               ? { kind: 'tab', id: springTarget.slice(4) }
               : { kind: 'folder', id: springTarget };
         springArrow = springDirection(target);
      }
      setMorph({
         descriptor: dragContext ? MORPH_DESCRIPTORS[dragContext] : null,
         springKey: springTarget,
         springArrow,
         morph: forceMorph,
      });
   }, [dragContext, springTarget, forceMorph, setMorph]);

   /**
    * Recomputes the drag context from the current kind + over-zone + lane flag and
    * commits it to state only when it actually changes (the puck re-renders rarely).
    */
   const updateContext = useCallback(() => {
      // In-drawer zones come from the manual geometry target (full-row, reliable);
      // non-drawer zones (play area / sheet) come from `overZoneRef` (dnd-kit `over`,
      // set in handleDragOver). The manual target wins when present.
      const manual = hoveredDrawerTargetRef.current;
      const zone: DragOverZone = manual
         ? (manual.kind === 'current-folder' ? 'drawer-items' : 'drawer-nav')
         : overZoneRef.current;
      const next = deriveDragContext(dragKindRef.current, zone, isOverTabLaneRef.current, sheetCompatibleRef.current);
      if (next !== dragContextRef.current) {
         dragContextRef.current = next;
         setDragContext(next);
      }
   }, []);

   /**
    * Drag-scoped `pointermove` handler: pins the puck to the cursor via a cheap
    * direct DOM write, runs the generous tab-lane hit test (characters only), and
    * refreshes the context. Attached to `window` on start, detached on end/cancel.
    */
   const handlePointerMove = useCallback((event: PointerEvent) => {
      // Pin the cursor cluster to the pointer (imperative; no re-render).
      setCursor(event.clientX, event.clientY);
      lastPointerRef.current = { x: event.clientX, y: event.clientY };

      const rect = tabStripElRef.current?.getBoundingClientRect() ?? null;
      const overLane = isOverTabLaneFor(dragKindRef.current, rect, event.clientX, event.clientY);
      if (overLane !== isOverTabLaneRef.current) {
         isOverTabLaneRef.current = overLane;
         setIsOverTabLane(overLane);
      }

      // Live-geometry hit-test of the drawer (re-queried each move, so scroll- and
      // navigation-correct by construction). Folder rows + Back drive the spring nav;
      // folder rows + the whole drawer panel drive the manual in-drawer DROP target.
      const backEl = document.querySelector('[data-drawer-back]');
      const backRect = backEl ? backEl.getBoundingClientRect() : null;
      const folders: SpringHitArea[] = Array.from(
         document.querySelectorAll<HTMLElement>('[data-folder-id]'),
      ).flatMap((el) => (el.dataset.folderId ? [{ id: el.dataset.folderId, rect: el.getBoundingClientRect() }] : []));
      const itemsAreaEl = document.querySelector('[data-drawer-items-area]');
      const itemsAreaRect = itemsAreaEl ? itemsAreaEl.getBoundingClientRect() : null;
      const drawerPanelEl = document.querySelector('[data-tour="drawer"]');
      const drawerPanelRect = drawerPanelEl ? drawerPanelEl.getBoundingClientRect() : null;

      const drawerTarget = resolveSpringTarget(
         folders,
         backRect,
         event.clientX,
         event.clientY,
         draggedFolderIdRef.current,
      );

      // Post-nav grace: once the cursor moves NAV_GRACE_PX from where a spring nav left
      // it, resume honoring folder-row drop targets normally.
      if (navGraceAnchorRef.current) {
         const dx = event.clientX - navGraceAnchorRef.current.x;
         const dy = event.clientY - navGraceAnchorRef.current.y;
         if (Math.hypot(dx, dy) > NAV_GRACE_PX) navGraceAnchorRef.current = null;
      }

      // The instantaneous in-drawer drop target (NOT the dwell target): the source of
      // truth for an in-drawer move at drop, replacing dnd-kit's center-only collision.
      // Back is NOT a drop target, over it (or anywhere in the drawer that isn't a
      // folder row) resolves to the current folder, read live at drop. During the
      // post-nav grace, force the current folder so a row that reflowed under the
      // stationary cursor (Back vanishing at root) isn't an accidental target.
      const inDrawerPanel = !!drawerPanelRect &&
         event.clientX >= drawerPanelRect.left && event.clientX <= drawerPanelRect.right &&
         event.clientY >= drawerPanelRect.top && event.clientY <= drawerPanelRect.bottom;
      hoveredDrawerTargetRef.current = navGraceAnchorRef.current
         ? (inDrawerPanel ? { kind: 'current-folder' } : null)
         : resolveDrawerDropTarget(folders, drawerPanelRect, event.clientX, event.clientY, draggedFolderIdRef.current);

      // Mirror the resolved target into reactive state for the drop indicators, scoped to
      // the resolver-driven drags (drawer moves) and committed only when the target's key
      // CHANGES (never per frame). Sheet/tab saves resolve their target via dnd-kit `over`,
      // so they stay null here, their indicators ride that path, and no full-row highlight
      // is shown where the (center-only) save could not honor it.
      const moveKind = dragKindRef.current;
      const isDrawerMoveDrag =
         moveKind === 'drawer-character' || moveKind === 'drawer-component' || moveKind === 'drawer-folder';
      const nextDropTarget = isDrawerMoveDrag ? hoveredDrawerTargetRef.current : null;
      const nextDropKey = drawerDropTargetKey(nextDropTarget);
      if (nextDropKey !== drawerDropTargetKeyRef.current) {
         drawerDropTargetKeyRef.current = nextDropKey;
         setDrawerDropTarget(nextDropTarget);
      }

      // Reorder insertion line: derive the before/after edge from the live
      // cursor vs the cached reorder target's rect (set in handleDragOver), committed only
      // on a key change.
      const reorderOver = reorderOverRef.current;
      const nextReorder: ReorderIndicator | null = reorderOver
         ? { listId: reorderOver.listId, overId: reorderOver.overId, position: resolveInsertPosition(reorderOver.rect, event.clientX, event.clientY, reorderOver.axis) }
         : null;
      reorderIndicatorRef.current = nextReorder;
      const nextReorderKey = nextReorder ? `${nextReorder.listId}:${nextReorder.overId}:${nextReorder.position}` : null;
      if (nextReorderKey !== reorderIndicatorKeyRef.current) {
         reorderIndicatorKeyRef.current = nextReorderKey;
         setReorderIndicator(nextReorder);
      }

      // The morph context reads the SAME manual signal, so the "drawer-move" cluster
      // lights up full-row (not center-only). Recomputed after the hit-test above.
      updateContext();

      // Tab auto-nav: a dragged drawer COMPONENT or sheet item can dwell on a
      // background tab to spring-switch the active character mid-drag (then drop on
      // its sheet). Tabs never overlap the drawer, so the drawer target wins ties.
      const kind = dragKindRef.current;
      const canTabNav = kind === 'drawer-component' || kind === 'sheet-item';
      let tabTarget = null;
      if (canTabNav && !drawerTarget) {
         const tabAreas: SpringHitArea[] = Array.from(
            document.querySelectorAll<HTMLElement>('[data-tab-id]'),
         ).flatMap((el) => (el.dataset.tabId ? [{ id: el.dataset.tabId, rect: el.getBoundingClientRect() }] : []));
         tabTarget = resolveTabSpringTarget(tabAreas, event.clientX, event.clientY, useTabManagerStore.getState().activeTabId);
      }

      springControllerRef.current?.setTarget(drawerTarget ?? tabTarget);

      // Force-morph (the "full card only in the drawer items area" rule): decide by
      // real cursor geometry against the items-area rect, NOT dnd-kit's `over`.
      const overItemsArea = !!itemsAreaRect &&
         event.clientX >= itemsAreaRect.left && event.clientX <= itemsAreaRect.right &&
         event.clientY >= itemsAreaRect.top && event.clientY <= itemsAreaRect.bottom;
      const nextForce = shouldForceMorph(dragKindRef.current, overItemsArea);
      if (nextForce !== forceMorphRef.current) {
         forceMorphRef.current = nextForce;
         setForceMorph(nextForce);
      }
   }, [updateContext, setCursor]);

   /**
    * Tears down the feedback layer: detaches the move listener and clears every
    * ref + its mirrored state. Called from both `handleDragEnd` and the cancel path
    * (and on unmount) so nothing leaks across drags.
    */
   const clearDragFeedback = useCallback(() => {
      window.removeEventListener('pointermove', handlePointerMove);
      dragKindRef.current = null;
      tabStripElRef.current = null;
      overZoneRef.current = null;
      if (isOverTabLaneRef.current) {
         isOverTabLaneRef.current = false;
         setIsOverTabLane(false);
      }
      if (dragContextRef.current) {
         dragContextRef.current = null;
         setDragContext(null);
      }
      // Abort any pending spring dwell (a drop / cancel must win over navigation).
      springControllerRef.current?.cancel();
      draggedFolderIdRef.current = null;
      springNavigatingRef.current = false;
      dragSourceCharacterIdRef.current = null;
      sheetCompatibleRef.current = true;
      hoveredDrawerTargetRef.current = null;
      if (drawerDropTargetKeyRef.current !== null) {
         drawerDropTargetKeyRef.current = null;
         setDrawerDropTarget(null);
      }
      reorderOverRef.current = null;
      reorderIndicatorRef.current = null;
      if (reorderIndicatorKeyRef.current !== null) {
         reorderIndicatorKeyRef.current = null;
         setReorderIndicator(null);
      }
      navGraceAnchorRef.current = null;
      lastPointerRef.current = null;
      if (forceMorphRef.current) {
         forceMorphRef.current = false;
         setForceMorph(false);
      }
      setSheetHighlight(null);
      setIsIncompatibleComponentDrag(false);
      // Clear the morph feedback (clone funnel + cursor cluster).
      resetMorph();
   }, [handlePointerMove, resetMorph]);

   // Safety net: never leak the window listener if the sheet unmounts mid-drag.
   useEffect(() => () => window.removeEventListener('pointermove', handlePointerMove), [handlePointerMove]);

   const handleDragStart = useCallback((event: DragStartEvent) => {
      const { active } = event;

      // Arm the drag-feedback layer for every drag: classify the source, cache the
      // strip element for the lane test, and attach the move listener.
      dragKindRef.current = classifyDrag(active);
      tabStripElRef.current = document.querySelector<HTMLElement>('[data-tab-strip]');
      isOverTabLaneRef.current = false;
      overZoneRef.current = null;
      // The dragged folder is excluded as a spring target (can't drill into what you hold).
      draggedFolderIdRef.current = dragKindRef.current === 'drawer-folder' ? String(active.id) : null;
      window.addEventListener('pointermove', handlePointerMove);

      // Capture the grab point so the clone funnels toward the cursor, not the card
      // center. dnd-kit provides the dragged element's initial rect + the activator.
      const activator = event.activatorEvent as PointerEvent | null;
      const initialRect = event.active.rect.current.initial;
      if (initialRect && activator && typeof activator.clientX === 'number') {
         captureGrab(initialRect, activator.clientX, activator.clientY);
      }

      // A tab drag is previewed via its own overlay branch, not as a sheet item.
      // Auto-open the drawer so the tab→drawer save has visible drop targets (the
      // chosen affordance; it does not auto-close).
      const untitledLabel = tNotifications('Tabs.untitled');

      if (active.data.current?.type === DRAG_TYPES.TAB) {
         setActiveTabDrag({ id: String(active.id), type: 'character' });
         setDrawerOpen(true);
         setIdentity(buildDragIdentity({ kind: dragKindRef.current, active, untitledLabel }));
         return;
      }

      if (active.data.current?.isDrawer) {
         const drawerItem = active.data.current.item as DrawerItem | FolderType;
         setActiveDragItem(drawerItem);
         setIdentity(buildDragIdentity({ kind: dragKindRef.current, active, untitledLabel }));
         // A component dragged while a character of a DIFFERENT game is loaded can't be
         // dropped on the sheet, flag it to show the "can't drop here" overlay.
         if (
            dragKindRef.current === 'drawer-component' && character &&
            (drawerItem as DrawerItem).game !== character.game
         ) {
            setIsIncompatibleComponentDrag(true);
         }
         return;
      }

      const allSheetItems = [...(character?.cards || []), ...(character?.trackers.statuses || []), ...(character?.trackers.storyTags || []), ...(character?.trackers.storyThemes || [])];
      const item = allSheetItems.find(i => i.id === active.id);
      if (item) {
         setActiveDragItem(item);
         setIdentity(buildDragIdentity({ kind: dragKindRef.current, active, sheetItem: item, untitledLabel }));
         // Remember the source character so a drop on a DIFFERENT tab's sheet (after
         // tab auto-nav) imports a copy instead of a no-op same-character reorder.
         dragSourceCharacterIdRef.current = character?.id ?? null;
      }
   }, [character, setDrawerOpen, handlePointerMove, captureGrab, setIdentity, tNotifications]);

   const handleDragOver = useCallback((event: DragOverEvent) => {
      const { active, over } = event;

      // A tab drag reorders within the strip's SortableContext and never touches the
      // sheet zones, but it CAN save into the drawer, so light the drawer items-area
      // while it is held over the drawer (mirroring a sheet-item save), then bail out of
      // the sheet/zone logic below.
      if (active.data.current?.type === DRAG_TYPES.TAB) {
         // Light the items-BODY dropzone only when over it, not over a folder/Back (a
         // tab save INTO a folder still works via the dnd-kit `over` at drop).
         const overId = over?.id.toString();
         setIsOverDrawer(overId?.startsWith('drawer-drop-zone-') ?? false);
         return;
      }

      setOverDragId(over ? over.id.toString() : null);

      // Cache the same-list reorder target for the insertion line: a
      // drawer item over a sibling item (same folder), or a sheet card/tracker over a
      // sibling of its kind. Self is excluded; the before/after edge is derived per-move
      // from the live cursor in handlePointerMove. Folders reorder via their own slots.
      const reorderActiveType = active.data.current?.type as string | undefined;
      const reorderOverType = over?.data.current?.type as string | undefined;
      if (over && over.id !== active.id) {
         const r = over.rect;
         const rect = { top: r.top, bottom: r.top + r.height, left: r.left, right: r.left + r.width };
         if (
            reorderActiveType === 'drawer-item' && reorderOverType === 'drawer-item' &&
            (active.data.current?.parentFolderId ?? null) === (over.data.current?.parentFolderId ?? null)
         ) {
            reorderOverRef.current = { listId: 'drawer-items', overId: over.id.toString(), rect, axis: 'vertical' };
         } else if (reorderActiveType === DRAG_TYPES.SHEET_CARD && reorderOverType === DRAG_TYPES.SHEET_CARD) {
            reorderOverRef.current = { listId: 'sheet-cards', overId: over.id.toString(), rect, axis: 'horizontal' };
         } else if (reorderActiveType === DRAG_TYPES.SHEET_TRACKER && reorderOverType === DRAG_TYPES.SHEET_TRACKER) {
            reorderOverRef.current = { listId: 'sheet-trackers', overId: over.id.toString(), rect, axis: 'horizontal' };
         } else {
            reorderOverRef.current = null;
         }
      } else {
         reorderOverRef.current = null;
      }

      let isHoveringDrawer = false;
      // The actionable surface under the cursor. The drawer splits into its items
      // area (reorder/land) and its nav area (folders, folder slots, Back). The thin
      // tab strip is handled by the generous pointermove test, not here.
      let zone: DragOverZone = null;
      let highlight: 'cards' | 'trackers' | null = null;
      if (over) {
        const activeType = active.data.current?.type as string;
        const overId = over.id.toString();
        const overType = over.data.current?.type as string | undefined;
        // Light the drawer items-BODY dropzone only when the cursor is actually over it
        // (`drawer-drop-zone-<id>`), NOT over a folder/Back, those are their own targets,
        // and lighting the body while aiming at a folder is misleading. A save INTO a
        // folder still works via the dnd-kit `over` at drop (handleSheetToDrawerDrop).
        const overIsItemsBody = overId.startsWith('drawer-drop-zone-');

         if (activeType?.startsWith('sheet-') && overIsItemsBody) {
            isHoveringDrawer = true;
         }

         if (overId === 'main-character-drop-zone') {
            zone = 'play-area';
         } else if (
            overId === 'character-sheet-main-drop-zone' || overId === 'tracker-drop-zone' || overId === 'card-drop-zone'
         ) {
            // Only the explicit sheet zones (resolved via pointerWithin when the cursor
            // is truly over them) count as 'sheet', NOT a closestCenter-snapped
            // sheet-card/tracker, which would mislabel neutral space.
            zone = 'sheet';
         } else if (overId.startsWith('drawer-drop-zone-') || overType === 'drawer-item') {
            zone = 'drawer-items';
         } else if (overType === 'drawer-folder' || overType === 'drawer-drop-zone' || overId.startsWith('drawer-back-button-')) {
            zone = 'drawer-nav';
         }

         // Content-aware sheet highlight: over the play area, only the section that
         // matches the dragged drawer item's type lights up (the drop is still
         // accepted anywhere on the sheet and routed by type). Game-incompatible
         // items neither highlight nor get an action glyph (no possible action).
         if (zone === 'sheet' && activeType === 'drawer-item' && character) {
            const item = active.data.current?.item as DrawerItem | undefined;
            const compatible = !!item && item.game === character.game;
            sheetCompatibleRef.current = compatible;
            if (compatible && item) highlight = sheetSectionForItemType(item.type);
         } else {
            sheetCompatibleRef.current = true;
         }
      } else {
         sheetCompatibleRef.current = true;
      }

      setIsOverDrawer(isHoveringDrawer);
      setSheetHighlight(highlight);
      // Only the NON-drawer zones come from dnd-kit's `over`; the in-drawer zones are
      // owned by the manual geometry target (set in handlePointerMove → updateContext),
      // which is reliable full-row where dnd-kit's collision is center-only.
      overZoneRef.current = zone === 'play-area' || zone === 'sheet' ? zone : null;
      updateContext();
   }, [updateContext, character]);

   /**
    * Handle reordering cards on the character sheet
    */
   const handleSheetCardReorder = useCallback((activeId: string, overId: string) => {
      if (!character) return;
      const oldIndex = character.cards.findIndex(item => item.id === activeId);
      const overIndex = character.cards.findIndex(item => item.id === overId);
      if (oldIndex !== -1 && overIndex !== -1) {
         // Land on the insertion line's edge; fall back to the over index.
         const ind = reorderIndicatorRef.current;
         const newIndex = ind && ind.listId === 'sheet-cards' && ind.overId === overId
            ? computeReorderTargetIndex(oldIndex, overIndex, ind.position)
            : overIndex;
         reorderCards(oldIndex, newIndex);
      }
   }, [character, reorderCards]);

   /**
    * Handle reordering trackers on the character sheet
    */
   const handleSheetTrackerReorder = useCallback((
      active: DragStartEvent['active'],
      over: NonNullable<DragOverEvent['over']>
   ) => {
      if (!character) return;

      const activeTracker = active.data.current?.item as Tracker;
      const overTracker = over.data.current?.item as Tracker;

      if (!activeTracker?.trackerType || !overTracker?.trackerType) return;
      if (activeTracker.trackerType !== overTracker.trackerType) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Land on the insertion line's edge; fall back to the over index.
      const ind = reorderIndicatorRef.current;
      const targetIndex = (oldIndex: number, overIndex: number): number =>
         ind && ind.listId === 'sheet-trackers' && ind.overId === overId
            ? computeReorderTargetIndex(oldIndex, overIndex, ind.position)
            : overIndex;

      if (activeTracker.trackerType === 'STATUS') {
         const oldIndex = character.trackers.statuses.findIndex(item => item.id === activeId);
         const overIndex = character.trackers.statuses.findIndex(item => item.id === overId);
         if (oldIndex !== -1 && overIndex !== -1) reorderStatuses(oldIndex, targetIndex(oldIndex, overIndex));
      } else if (activeTracker.trackerType === 'STORY_TAG') {
         const oldIndex = character.trackers.storyTags.findIndex(item => item.id === activeId);
         const overIndex = character.trackers.storyTags.findIndex(item => item.id === overId);
         if (oldIndex !== -1 && overIndex !== -1) reorderStoryTags(oldIndex, targetIndex(oldIndex, overIndex));
      } else if (activeTracker.trackerType === 'STORY_THEME') {
         const oldIndex = character.trackers.storyThemes.findIndex(item => item.id === activeId);
         const overIndex = character.trackers.storyThemes.findIndex(item => item.id === overId);
         if (oldIndex !== -1 && overIndex !== -1) reorderStoryThemes(oldIndex, targetIndex(oldIndex, overIndex));
      }
   }, [character, reorderStatuses, reorderStoryTags, reorderStoryThemes]);

   /**
    * Handle dropping sheet items (cards/trackers) back into the drawer
    */
   const handleSheetToDrawerDrop = useCallback((
      overIdStr: string,
      overType: string,
      over: NonNullable<DragOverEvent['over']>
   ) => {
      if (!activeDragItem) return;

      let destinationFolderId: string | undefined = undefined;

      if (overType === 'drawer-folder') {
         destinationFolderId = overIdStr;
      } else if (overIdStr.startsWith('drawer-drop-zone-')) {
         const parsedId = overIdStr.replace('drawer-drop-zone-', '');
         destinationFolderId = parsedId === 'root' ? undefined : parsedId;
      } else if (overType === 'drawer-back-button') {
         destinationFolderId = over.data.current?.destinationId ?? undefined;
      }

      const storableInfo = mapItemToStorableInfo(activeDragItem as CardData | Tracker);
      if (!storableInfo) return;
      const [generalType, gameSystem] = storableInfo;

      const itemContentCopy = JSON.parse(JSON.stringify(activeDragItem));
      if ('isFlipped' in itemContentCopy) itemContentCopy.isFlipped = false;

      const defaultName = 'title' in activeDragItem ? activeDragItem.title :
                     'name' in activeDragItem ? activeDragItem.name : 'New Item';

      initiateItemDrop({
         game: gameSystem,
         type: generalType,
         content: itemContentCopy,
         parentFolderId: destinationFolderId,
         defaultName
      });
   }, [activeDragItem, initiateItemDrop]);

   /**
    * Save a dragged tab's character to the drawer as a NEW linked copy (owner
    * decision: never overwrites). The character is resolved from its OWN instance by
    * id, so dragging a background tab saves the right character, not the active one.
    * The destination folder is derived from the drop target exactly as
    * {@link handleSheetToDrawerDrop} does, and the live character is linked to the new
    * item id WITHOUT clearing that tab's undo stack (`linkToDrawerItem`).
    *
    * @param tabId - The dragged tab's character id (its store instance key).
    * @param overIdStr - The drop target's id.
    * @param overType - The drop target's `data.current.type`.
    * @param over - The drop target (for a back-button's `destinationId`).
    */
   const saveTabToDrawer = useCallback((
      tabId: string,
      overIdStr: string,
      overType: string,
      over: NonNullable<DragOverEvent['over']>,
   ) => {
      const instance = getOrCreateInstance(tabId);
      const tabCharacter = instance.getState().character;
      if (!tabCharacter) return;

      let destinationFolderId: string | undefined = undefined;
      if (overType === 'drawer-folder') {
         destinationFolderId = overIdStr;
      } else if (overIdStr.startsWith('drawer-drop-zone-')) {
         const parsedId = overIdStr.replace('drawer-drop-zone-', '');
         destinationFolderId = parsedId === 'root' ? undefined : parsedId;
      } else if (overType === 'drawer-back-button') {
         destinationFolderId = over.data.current?.destinationId ?? undefined;
      }

      const newItemId = cuid();
      instance.getState().actions.linkToDrawerItem(newItemId);
      // The tab now has a saved drawer copy. linkToDrawerItem swaps in a new character
      // reference, so the change subscription re-dirties it; assert clean after.
      instance.getState().actions.setHasUnsavedChanges(false);
      initiateItemDrop({
         game: tabCharacter.game,
         type: 'FULL_CHARACTER_SHEET',
         content: { ...tabCharacter, drawerItemId: newItemId },
         parentFolderId: destinationFolderId,
         presetId: newItemId,
         defaultName: tabCharacter.name,
      });
   }, [initiateItemDrop]);

   const handleDragEnd = useCallback((event: DragEndEvent) => {
      const { active, over } = event;

      // Read the feedback refs BEFORE tearing them down (clearDragFeedback resets them).
      const wasOverTabLane = isOverTabLaneRef.current;
      const dragKind = dragKindRef.current;
      const manualDrawerTarget = hoveredDrawerTargetRef.current;

      setActiveDragItem(null);
      setIsOverDrawer(false);
      setOverDragId(null);
      setActiveTabDrag(null);
      clearDragFeedback();

      // ##################################################
      // ###   Generous tab lane (drawer character)     ###
      // ##################################################
      // A character released anywhere in the padded top band opens/focuses its tab,
      // even when @dnd-kit's thin `tab-strip-drop-zone` was missed (so this runs
      // BEFORE the `over` null-guard). The kind guard keeps it character-only.
      if (wasOverTabLane && dragKind === 'drawer-character') {
         const draggedItem = active.data.current?.item as DrawerItem | undefined;
         if (draggedItem?.type === 'FULL_CHARACTER_SHEET') {
            const characterData = draggedItem.content as Character;
            openCharacterTab(characterData, draggedItem.id); // append-or-focus
            setContextualGame(characterData.game);
         }
         return;
      }

      // ##################################################
      // ###   Manual in-drawer drop targeting          ###
      // ##################################################
      // For a drawer-sourced drag, the in-drawer DROP target is resolved by live cursor
      // geometry, NOT dnd-kit's `over`, its collision rects desync in
      // the scrollable/animated drawer (folder drops were center-only). This runs BEFORE
      // the `over` null-guard so an off-center drop the collision missed still lands.
      // A folder-row target moves into that folder; a current-folder target (Back, the
      // items body, anywhere else in the drawer) moves into the folder currently being
      // VIEWED, read live from the store, so a dwell-Back-then-release lands in the
      // folder you navigated to (not its parent). Same-folder current-folder drops fall
      // through to the dnd-kit reorder path below.
      const activeIsDrawerMove =
         dragKind === 'drawer-character' || dragKind === 'drawer-component' || dragKind === 'drawer-folder';
      if (activeIsDrawerMove && manualDrawerTarget) {
         const draggedId = active.id.toString();
         const isFolderDrag = dragKind === 'drawer-folder';

         // Folder onto a reorder SLOT → place at that exact position, ahead of the generic
         // folder-row / current-folder handling so the user lands where the highlighted slot
         // shows. When the dragged folder is already in this view it is a pure reorder; when
         // it arrived via a spring navigation it is moved into the current folder and then
         // slotted into place (an append + reorder, hence two undo steps).
         if (isFolderDrag && over?.data.current?.type === 'drawer-drop-zone') {
            const destParentId = useDrawerStore.getState().currentFolderId ?? null;
            const scope = useDrawerStore.getState().currentFolderView?.folders ?? [];
            const { targetId } = over.data.current as { targetId: string };
            const fromIndex = scope.findIndex((f) => f.id === draggedId);
            const slotIndex = targetId === 'last' ? scope.length : scope.findIndex((f) => f.id === targetId);
            if (fromIndex !== -1) {
               let newIndex = targetId === 'last' ? scope.length - 1 : slotIndex;
               if (newIndex !== -1) {
                  if (fromIndex < newIndex) newIndex -= 1;
                  if (fromIndex !== newIndex) void reorderFolders(destParentId, fromIndex, newIndex);
               }
            } else {
               const targetIndex = slotIndex < 0 ? scope.length : slotIndex;
               void (async () => {
                  await moveFolder(draggedId, destParentId ?? undefined);
                  const after = useDrawerStore.getState().currentFolderView?.folders ?? [];
                  const appendedIndex = after.findIndex((f) => f.id === draggedId);
                  if (appendedIndex !== -1 && appendedIndex !== targetIndex) {
                     await reorderFolders(destParentId, appendedIndex, targetIndex);
                  }
               })();
            }
            return;
         }

         if (manualDrawerTarget.kind === 'folder') {
            if (manualDrawerTarget.id !== draggedId) {
               if (isFolderDrag) void moveFolder(draggedId, manualDrawerTarget.id);
               else void moveItem(draggedId, manualDrawerTarget.id);
            }
            return;
         }
         // current-folder: move into the folder being VIEWED, unless the dragged item is
         // ALREADY a child of it (then fall through to reorder). The source of truth is
         // the loaded current-folder view, NOT the drag data's `parentFolderId`, which is
         // stale/null after a spring navigation (it reported ROOT for an item dragged from
         // a folder, making a real cross-folder drop look like a same-folder no-op).
         const currentFolderId = useDrawerStore.getState().currentFolderId ?? null;
         const view = useDrawerStore.getState().currentFolderView;
         const alreadyInCurrentFolder = isFolderDrag
            ? (view?.folders ?? []).some((f) => f.id === draggedId)
            : (view?.items ?? []).some((i) => i.id === draggedId);
         if (!alreadyInCurrentFolder) {
            if (isFolderDrag) void moveFolder(draggedId, currentFolderId ?? undefined);
            else void moveItem(draggedId, currentFolderId ?? undefined);
            return;
         }
         // Already in the current folder → fall through to the dnd-kit reorder path below.
      }

      if (!over || active.id === over.id) {
         return;
      }

      const activeType = active.data.current?.type as string;
      const overType = over.data.current?.type as string;
      const overIdStr = over.id.toString();

      // ##########################################
      // ###   BRANCH 0: Reordering tab strip   ###
      // ##########################################
      // A tab reorders against another tab, or saves to the drawer when dropped on a
      // drawer target (collision detection scopes a tab drag to those two). Reorder
      // persistence is the TabManager's; the save creates a new linked drawer copy.
      if (activeType === DRAG_TYPES.TAB) {
         const tabId = (active.data.current?.tabId as string) ?? String(active.id);
         if (overType === DRAG_TYPES.TAB) {
            reorderTabs(String(active.id), String(over.id));
         } else if (overIdStr.startsWith('drawer-drop-zone-') || overType?.startsWith('drawer-')) {
            saveTabToDrawer(tabId, overIdStr, overType, over);
         }
         return;
      }

      // ##############################################
      // ###   BRANCH 1: Dragging FROM the Drawer   ###
      // ##############################################
      if (activeType === 'drawer-item' || activeType === 'drawer-folder') {

         // ==================
         //  SCENARIO 1.1: Dropping a full character onto the play area
         // ==================
         if (overIdStr === 'main-character-drop-zone') {
            const draggedItem = active.data.current?.item as DrawerItem;
            if (draggedItem?.type === 'FULL_CHARACTER_SHEET') {
               const characterData = draggedItem.content as Character;
               openCharacterTab(characterData, draggedItem.id);
               setContextualGame(characterData.game);
            }
            return;
         }

         // ==================
         //  SCENARIO 1.1b: Dropping a character onto the tab strip (open or focus)
         // ==================
         // Only FULL_CHARACTER_SHEET items are valid here; anything else is a no-op.
         if (overIdStr === 'tab-strip-drop-zone') {
            const draggedItem = active.data.current?.item as DrawerItem;
            if (draggedItem?.type === 'FULL_CHARACTER_SHEET') {
               const characterData = draggedItem.content as Character;
               openCharacterTab(characterData, draggedItem.id); // append-or-focus
               setContextualGame(characterData.game);
            }
            return;
         }

         // ==================
         //  SCENARIO 1.2: Dropping INSIDE the drawer
         // ==================
         if (overType?.startsWith('drawer-') || overIdStr.startsWith('drawer-')) {
            const activeIsItem = activeType === 'drawer-item';
            const parentFolderId = active.data.current?.parentFolderId ?? null;
            // Scope = the currently loaded folder's children (the drawer only ever
            // shows one folder, so every in-drawer drag originates there).
            const itemsInScope = currentFolderView?.items ?? [];

            // NOTE: moves INTO a folder / Back / the items body of a different folder, and
            // ALL folder slot placements (reorder + cross-folder insert), are handled by the
            // manual geometry resolver above; this block now only handles same-folder
            // item REORDER, which dnd-kit's `over` resolves reliably.

            // Same-folder item REORDER over a sibling row. Land on the exact edge the
            // insertion line showed: the cursor-resolved before/after, not
            // dnd-kit's direction-default. Fall back to the over index if no indicator.
            if (overType === 'drawer-item' && activeIsItem && parentFolderId === (over.data.current?.parentFolderId ?? null)) {
               const oldIndex = itemsInScope.findIndex(item => item.id === active.id);
               const overIndex = itemsInScope.findIndex(item => item.id === over.id);
               if (oldIndex !== -1 && overIndex !== -1) {
                  const ind = reorderIndicatorRef.current;
                  const newIndex = ind && ind.listId === 'drawer-items' && ind.overId === over.id.toString()
                     ? computeReorderTargetIndex(oldIndex, overIndex, ind.position)
                     : overIndex;
                  void reorderItems(parentFolderId, oldIndex, newIndex);
               }
               return;
            }
         }

         // ==================
         //  SCENARIO 1.3: Dropping ONTO the character sheet
         // ==================
         // (Requires a character to be loaded)
         if (!character) return;

         const isOverSheet = overIdStr === 'character-sheet-main-drop-zone' ||
                              overIdStr === 'tracker-drop-zone' ||
                              overIdStr === 'card-drop-zone' ||
                              overType === 'sheet-card' ||
                              overType === 'sheet-tracker';

         if (isOverSheet) {
            if (activeType !== 'drawer-item') return;

            const draggedItem = active.data.current?.item as DrawerItem;
            if (!draggedItem) return;

            const isTrackerType = draggedItem.type === 'STATUS_TRACKER' || draggedItem.type === 'STORY_TAG_TRACKER' || draggedItem.type === 'STORY_THEME_TRACKER';
            const isCardType = draggedItem.type === 'CHARACTER_CARD' || draggedItem.type === 'CHARACTER_THEME' || draggedItem.type === 'GROUP_THEME' || draggedItem.type === 'LOADOUT_THEME';

            // Only sheet components add here; a FULL_CHARACTER_SHEET over the sheet is
            // not a failure (it opens a tab via its own zone), so don't toast for it.
            if (!isTrackerType && !isCardType) return;

            // Game mismatch: the drop can't land, tell the user why instead of a silent no-op.
            if (draggedItem.game !== character.game) {
               toast.error(tNotifications('Notifications.general.importFailedWrongGame'));
               return;
            }

            if (isTrackerType) {
               addImportedTracker(draggedItem.content as Tracker);
               toast.success(tNotifications('Notifications.character.componentImported'));
            } else if (isCardType) {
               addImportedCard(draggedItem.content as CardData);
               toast.success(tNotifications('Notifications.character.componentImported'));
            }
            return;
         }
      }

      // #############################################
      // ###   BRANCH 2: Dragging FROM the Sheet   ###
      // #############################################
      if (activeType?.startsWith('sheet-')) {

         // ==================
         //  SCENARIO 2.0: Dropping on a DIFFERENT character's sheet (after tab auto-nav)
         // ==================
         // The sheet item came from another tab; import a copy into the now-active
         // character (game must match). A same-character drop falls through to reorder.
         const overIsSheetZone = overIdStr === 'character-sheet-main-drop-zone' ||
            overIdStr === 'card-drop-zone' || overIdStr === 'tracker-drop-zone' ||
            overType?.startsWith('sheet-');
         if (
            character && activeDragItem && overIsSheetZone &&
            dragSourceCharacterIdRef.current && dragSourceCharacterIdRef.current !== character.id
         ) {
            const info = mapItemToStorableInfo(activeDragItem as CardData | Tracker);
            if (info && info[1] === character.game) {
               if ('cardType' in activeDragItem) {
                  addImportedCard(activeDragItem as CardData);
                  toast.success(tNotifications('Notifications.character.componentImported'));
               } else if ('trackerType' in activeDragItem) {
                  addImportedTracker(activeDragItem as Tracker);
                  toast.success(tNotifications('Notifications.character.componentImported'));
               }
            }
            return;
         }

         // ==================
         //  SCENARIO 2.1: Dropping ONTO the drawer
         // ==================
         if (overIdStr.startsWith('drawer-drop-zone-') || overType?.startsWith('drawer-')) {
            handleSheetToDrawerDrop(overIdStr, overType, over);
            return;
         }

         // ==================
         //  SCENARIO 2.2: Reordering ON the sheet
         // ==================
         if (overType?.startsWith('sheet-') && character) {
            if (activeType === DRAG_TYPES.SHEET_CARD && overType === DRAG_TYPES.SHEET_CARD) {
               handleSheetCardReorder(active.id as string, over.id as string);
            } else if (activeType === DRAG_TYPES.SHEET_TRACKER) {
               handleSheetTrackerReorder(active, over);
            }
         }
      }
   }, [
      character,
      currentFolderView,
      moveFolder,
      reorderFolders,
      moveItem,
      reorderItems,
      handleSheetCardReorder,
      handleSheetTrackerReorder,
      handleSheetToDrawerDrop,
      saveTabToDrawer,
      openCharacterTab,
      reorderTabs,
      setContextualGame,
      addImportedTracker,
      addImportedCard,
      tNotifications,
      clearDragFeedback,
      activeDragItem,
   ]);

   /**
    * Clears all transient drag state when a drag is cancelled (Escape, or a drop
    * outside any droppable). Mirrors the reset at the top of `handleDragEnd` so the
    * overlay (including a tab preview) never lingers after a cancelled drag.
    */
   const handleDragCancel = useCallback(() => {
      setActiveDragItem(null);
      setIsOverDrawer(false);
      setOverDragId(null);
      setActiveTabDrag(null);
      clearDragFeedback();
   }, [clearDragFeedback]);

   return {
      activeDragItem,
      activeTabDrag,
      overDragId,
      isOverDrawer,
      // Resolved full-row in-drawer drop target, driving the folder nest + items-area
      // highlights so they match the drop.
      drawerDropTarget,
      // Reorder insertion-line indicator: list + over + before/after.
      reorderIndicator,
      statusIds,
      storyTagIds,
      storyThemeIds,
      cardIds,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
      // Strip highlight: the generous tab-lane flag.
      isOverTabLane,
      // The active dwell target id (folder id or the Back sentinel), for the static
      // row/Back highlight.
      springTarget,
      // Content-aware sheet highlight: which section to light up.
      sheetHighlight,
      // True while a game-incompatible component is dragged with a character loaded,
      // driving the "can't drop here" overlay.
      isIncompatibleComponentDrag,
      // Drag-morph engine slots: clone goes inside <DragOverlay>, cluster is a sibling.
      renderClone,
      renderCluster,
   };
}
