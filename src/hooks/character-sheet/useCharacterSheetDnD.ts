// -- React Imports --
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';
import cuid from 'cuid';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';

// -- Utils Imports --
import { mapItemToStorableInfo } from '@/lib/utils/dnd';
import { MORPH_DESCRIPTORS, SPRING_BACK_KEY, createSpringController, deriveDragContext, isOverTabLaneFor, resolveSpringTarget, springDirection } from '@/lib/utils/dragFeedback';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- Drag-morph engine (tabs polish-8) --
import { useDragMorph } from '@/components/molecules/drag-morph/useDragMorph';

// -- Store Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';
import { getOrCreateInstance } from '@/lib/character/characterStoreRegistry';
import { useDrawerStore, useDrawerActions } from '@/lib/stores/drawerStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

// -- Type Imports --
import type { Character, Card as CardData, Tracker } from '@/lib/types/character';
import type { DrawerItem, Folder as FolderType } from '@/lib/types/drawer';
import type { OpenTab } from '@/lib/character/tabManagerStore';
import type { DragContext, DragKind, DragOverZone, SpringController, SpringHitArea, SpringTarget } from '@/lib/utils/dragFeedback';



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
   const { openCharacterTab, reorderTabs } = useTabManagerActions();
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
   //  Drag-feedback layer (tabs polish-6): context derivation + generous tab lane
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

   // ==================
   //  Drag-morph engine (tabs polish-8)
   // ==================
   // The reusable overlay-feedback engine (funnel clone + cursor cluster). This hook
   // computes the signals (cursor, descriptor, spring) and feeds them in; the engine
   // owns only the visual choreography and knows nothing of drawers/tabs/navigation.
   const { captureGrab, setCursor, setMorph, reset: resetMorph, renderClone, renderCluster } = useDragMorph();

   // ==================
   //  Spring-loaded drawer navigation (tabs polish-7)
   // ==================
   // Dwelling on a folder row / Back button mid-drag drills the drawer there without
   // ending the drag, so a deep move is one continuous gesture. `springTarget` (state)
   // drives the progress affordance on the hovered row; `draggedFolderIdRef` excludes
   // the held folder; `springNavigatingRef` guards against re-firing while a (async)
   // navigation is in flight. The controller owns the dwell timer (see dragFeedback).
   const [springTarget, setSpringTarget] = useState<string | null>(null);
   const draggedFolderIdRef = useRef<string | null>(null);
   const springNavigatingRef = useRef(false);

   /**
    * Performs a spring navigation when a dwell completes: drill into a folder, or go
    * up via the parent (read fresh from the store so Back is never stale). Guards
    * against re-firing while a navigation is in flight; the next pointer move
    * re-derives the dwell against the freshly loaded view, chaining multi-level
    * drilling without ending the drag.
    */
   const handleSpringNavigate = useCallback((target: SpringTarget) => {
      if (springNavigatingRef.current) return;
      const destination = target.kind === 'back' ? useDrawerStore.getState().parentFolderId : target.id;
      springNavigatingRef.current = true;
      void Promise.resolve(setDrawerCurrentFolderId(destination)).finally(() => {
         springNavigatingRef.current = false;
      });
   }, [setDrawerCurrentFolderId]);

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
   // the spring target changes (polish-8). The arrow mirrors springDirection() for
   // the active dwell; the engine renders, knowing nothing of what the action means.
   useEffect(() => {
      const springArrow = springTarget == null
         ? null
         : springDirection(springTarget === SPRING_BACK_KEY ? { kind: 'back' } : { kind: 'folder', id: springTarget });
      setMorph({
         descriptor: dragContext ? MORPH_DESCRIPTORS[dragContext] : null,
         springKey: springTarget,
         springArrow,
      });
   }, [dragContext, springTarget, setMorph]);

   /**
    * Recomputes the drag context from the current kind + over-zone + lane flag and
    * commits it to state only when it actually changes (the puck re-renders rarely).
    */
   const updateContext = useCallback(() => {
      const next = deriveDragContext(dragKindRef.current, overZoneRef.current, isOverTabLaneRef.current);
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

      const rect = tabStripElRef.current?.getBoundingClientRect() ?? null;
      const overLane = isOverTabLaneFor(dragKindRef.current, rect, event.clientX, event.clientY);
      if (overLane !== isOverTabLaneRef.current) {
         isOverTabLaneRef.current = overLane;
         setIsOverTabLane(overLane);
      }

      updateContext();

      // Spring-loaded drawer navigation: hit-test the live folder rows + Back button
      // against the cursor (re-queried each move, so it stays correct across spring-
      // navigations) and feed the result to the dwell controller. Empty/absent when
      // the drawer is closed, so this no-ops for drags that never enter the drawer.
      const backEl = document.querySelector('[data-drawer-back]');
      const backRect = backEl ? backEl.getBoundingClientRect() : null;
      const folders: SpringHitArea[] = Array.from(
         document.querySelectorAll<HTMLElement>('[data-folder-id]'),
      ).flatMap((el) => (el.dataset.folderId ? [{ id: el.dataset.folderId, rect: el.getBoundingClientRect() }] : []));
      const springTargetUnderCursor = resolveSpringTarget(
         folders,
         backRect,
         event.clientX,
         event.clientY,
         draggedFolderIdRef.current,
      );
      springControllerRef.current?.setTarget(springTargetUnderCursor);
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
      if (active.data.current?.type === DRAG_TYPES.TAB) {
         setActiveTabDrag({ id: String(active.id), type: 'character' });
         setDrawerOpen(true);
         return;
      }

      if (active.data.current?.isDrawer) {
         setActiveDragItem(active.data.current.item as DrawerItem | FolderType);
         return;
      }

      const allSheetItems = [...(character?.cards || []), ...(character?.trackers.statuses || []), ...(character?.trackers.storyTags || []), ...(character?.trackers.storyThemes || [])];
      const item = allSheetItems.find(i => i.id === active.id);
      if (item) {
         setActiveDragItem(item);
      }
   }, [character?.cards, character?.trackers, setDrawerOpen, handlePointerMove, captureGrab]);

   const handleDragOver = useCallback((event: DragOverEvent) => {
      const { active, over } = event;

      // A tab drag reorders within the strip's SortableContext; it has no bearing on
      // the drawer-hover state, so leave that untouched.
      if (active.data.current?.type === DRAG_TYPES.TAB) return;

      setOverDragId(over ? over.id.toString() : null);

      let isHoveringDrawer = false;
      // The actionable surface under the cursor, for the puck context. The thin
      // tab strip is handled by the generous pointermove test, not here.
      let zone: DragOverZone = null;
      if (over) {
        const activeType = active.data.current?.type as string;
        const overId = over.id.toString();
        const overType = over.data.current?.type as string | undefined;
        const overIsDrawerComponent = over.data.current?.isDrawer || overId.startsWith('drawer-drop-zone-');

         if (activeType?.startsWith('sheet-') && overIsDrawerComponent) {
            isHoveringDrawer = true;
         }

         if (overId === 'main-character-drop-zone') {
            zone = 'play-area';
         } else if (
            overId === 'character-sheet-main-drop-zone' || overId === 'tracker-drop-zone' ||
            overId === 'card-drop-zone' || overType === 'sheet-card' || overType === 'sheet-tracker'
         ) {
            zone = 'sheet';
         } else if (overIsDrawerComponent || (typeof overType === 'string' && overType.startsWith('drawer-'))) {
            zone = 'drawer';
         }
      }

      setIsOverDrawer(isHoveringDrawer);
      overZoneRef.current = zone;
      updateContext();
   }, [updateContext]);

   /**
    * Handle reordering cards on the character sheet
    */
   const handleSheetCardReorder = useCallback((activeId: string, overId: string) => {
      if (!character) return;
      const oldIndex = character.cards.findIndex(item => item.id === activeId);
      const newIndex = character.cards.findIndex(item => item.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
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

      if (activeTracker.trackerType === 'STATUS') {
         const oldIndex = character.trackers.statuses.findIndex(item => item.id === activeId);
         const newIndex = character.trackers.statuses.findIndex(item => item.id === overId);
         if (oldIndex !== -1 && newIndex !== -1) reorderStatuses(oldIndex, newIndex);
      } else if (activeTracker.trackerType === 'STORY_TAG') {
         const oldIndex = character.trackers.storyTags.findIndex(item => item.id === activeId);
         const newIndex = character.trackers.storyTags.findIndex(item => item.id === overId);
         if (oldIndex !== -1 && newIndex !== -1) reorderStoryTags(oldIndex, newIndex);
      } else if (activeTracker.trackerType === 'STORY_THEME') {
         const oldIndex = character.trackers.storyThemes.findIndex(item => item.id === activeId);
         const newIndex = character.trackers.storyThemes.findIndex(item => item.id === overId);
         if (oldIndex !== -1 && newIndex !== -1) reorderStoryThemes(oldIndex, newIndex);
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
    * id, so dragging a background tab saves the right character — not the active one.
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

      setActiveDragItem(null);
      setIsOverDrawer(false);
      setOverDragId(null);
      setActiveTabDrag(null);
      clearDragFeedback();

      // ##################################################
      // ###   Generous tab lane (drawer character)     ###
      // ##################################################
      // A character released anywhere in the padded top band opens/focuses its tab —
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
            const activeIsFolder = activeType === 'drawer-folder';
            const activeIsItem = activeType === 'drawer-item';
            const parentFolderId = active.data.current?.parentFolderId ?? null;
            // Scope = the currently loaded folder's children (the drawer only ever
            // shows one folder, so every in-drawer drag originates there).
            const foldersInScope = currentFolderView?.folders ?? [];
            const itemsInScope = currentFolderView?.items ?? [];

            if (overIdStr.startsWith('drawer-back-button-')) {
               const draggedId = active.id.toString();
               const destinationId = over.data.current?.destinationId;
               if (activeIsFolder) void moveFolder(draggedId, destinationId);
               if (activeIsItem) void moveItem(draggedId, destinationId);
               return;
            }
            if (overType === 'drawer-drop-zone' && activeIsFolder) {
               const oldIndex = foldersInScope.findIndex(folder => folder.id === active.id);
               if (oldIndex === -1) return;
               const { targetId } = over.data.current as { targetId: string; };
               let newIndex = (targetId === 'last')
                  ? foldersInScope.length - 1
                  : foldersInScope.findIndex(folder => folder.id === targetId);
               if (newIndex === -1) return;
               if (oldIndex < newIndex) newIndex--;
               if (oldIndex === newIndex) return;
               void reorderFolders(parentFolderId, oldIndex, newIndex);
               return;
            }
            if (overType === 'drawer-folder') {
               if (active.id === over.id) return;
               const draggedId = active.id.toString();
               const destinationFolderId = overIdStr;
               if (activeIsFolder) void moveFolder(draggedId, destinationFolderId);
               if (activeIsItem) void moveItem(draggedId, destinationFolderId);
               return;
            }
            if (overType === 'drawer-item' && activeIsItem) {
               if (active.data.current?.parentFolderId !== over.data.current?.parentFolderId) return;
               const oldIndex = itemsInScope.findIndex(item => item.id === active.id);
               const newIndex = itemsInScope.findIndex(item => item.id === over.id);
               if (oldIndex !== -1 && newIndex !== -1) void reorderItems(parentFolderId, oldIndex, newIndex);
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
            if (!draggedItem || draggedItem.game !== character.game) return;

            const isTrackerType = draggedItem.type === 'STATUS_TRACKER' || draggedItem.type === 'STORY_TAG_TRACKER' || draggedItem.type === 'STORY_THEME_TRACKER';
            const isCardType = draggedItem.type === 'CHARACTER_CARD' || draggedItem.type === 'CHARACTER_THEME' || draggedItem.type === 'GROUP_THEME' || draggedItem.type === 'LOADOUT_THEME';

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
      statusIds,
      storyTagIds,
      storyThemeIds,
      cardIds,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
      // Strip highlight (tabs polish-6): the generous tab-lane flag.
      isOverTabLane,
      // Spring-loaded drawer navigation (tabs polish-7): the active dwell target id
      // (folder id or the Back sentinel), for the static row/Back highlight.
      springTarget,
      // Drag-morph engine slots (tabs polish-8): clone goes inside <DragOverlay>,
      // cluster is a sibling.
      renderClone,
      renderCluster,
   };
}
