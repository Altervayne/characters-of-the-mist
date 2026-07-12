// -- React Imports --
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';
import { useDroppable } from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import cuid from 'cuid';

// -- Icon Imports --
import { ChevronLeft, ChevronRight, Copy, Crosshair, FilePlus2, Grid3x3, Grip, LayoutGrid, ListChecks, Maximize, Plus, Skull, Square, Trash2, X } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { fitViewport, gridSpacing, itemsInMarquee, screenDeltaToWorld, screenToWorld, zoomToCursor } from '@/lib/board/boardCoordinates';
import { DEFAULT_CONNECTION_STYLE } from '@/lib/board/boardConnections';
import { zoneContaining, zoneContentMinSize } from '@/lib/board/zoneMembership';
import { BACK_LAYER_Z_INDEX, connectionsZIndex, groupToolbarZIndex, itemZIndex } from '@/lib/board/boardLayering';
import { EMBEDDED_TRACKER_SIZES, EMBEDDED_CARD_SIZE, embeddedSpecForDrawerItem } from '@/lib/board/embedDrawerItem';
import { getItem } from '@/lib/drawer/drawerRepository';
import { emptyTracker, type TrackerType } from '@/lib/trackers/emptyTracker';
import { buildCard } from '@/lib/cards/buildCard';
import { GAME_VISUALS, GAME_CARD_OPTIONS } from '@/lib/constants/gameVisuals';
import { getItemTypeIconComponent } from '@/lib/utils/drawer-icons';
import { CREATABLE_REGISTRY, CREATABLE_BY_KIND, type CreatableKind } from '@/lib/creation/creatableRegistry';
import { makePortalContent, portalTargetFromInsert } from '@/lib/creation/portalContent';
import { PORTAL_MIN_SIZE } from '@/lib/board/portalSizing';
import { useCommitOnUnmount } from '@/hooks/useCommitOnUnmount';
import { runSaveImageToDrawerAs, runSaveItemToDrawer, runSaveItemToDrawerAs } from '@/hooks/board/useBoardItemSaveBack';

// -- Component Imports --
import { BoardItemBox } from './BoardItemBox';
import { BoardConnectionsLayer } from './BoardConnectionsLayer';
import { BoardGroupToolbar } from './BoardGroupToolbar';
import { BoardRadialMenu, type RadialNode } from './BoardRadialMenu';
import { BoardAddGameElementMenu } from './BoardAddGameElementMenu';
import { CardCreationForm } from '@/components/organisms/cards/CardCreationForm';
import { LinkTargetList } from '@/components/molecules/links/LinkTargetList';
import { BoardPortalEditor } from './items/BoardPortalEditor';

// -- Store Imports --
import { useActiveBoardInstance } from '@/lib/board/ActiveBoardStoreContext';
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useDrawerStore } from '@/lib/stores/drawerStore';

// -- React Imports --
import type { CSSProperties, ReactNode } from 'react';

// -- Type Imports --
import type { BoardStore } from '@/lib/stores/boardStore';
import type { BoardGrid, BoardGridType, BoardItem, BoardItemContent, ConnectionStyle, PortalBoardContent, PortalStyle, PortalTarget, Viewport } from '@/lib/types/board';
import type { LinkInsertTarget } from '@/lib/portals/buildLinkToken';
import type { Point } from '@/lib/board/boardConnections';
import type { GameSystem, GeneralItemType } from '@/lib/types/drawer';
import type { CreateCardOptions } from '@/lib/types/creation';

/*
 * The board canvas: a pan/zoom world layer over the active board, with freeform move /
 * resize / select / z-order / delete wired to the board store's commands, plus a
 * creation palette for the board-native item kinds. It reads the ACTIVE BOARD instance
 * (never the character context) and only mounts when a board tab is active. Embedded
 * drawer items, connections, and threats are later prompts.
 */

/**
 * The tracker create actions, in ring order. `itemType` maps each `TrackerType` to its drawer item
 * type so the radial pulls the SAME glyph as the drawer list view (via `getItemTypeIconComponent`),
 * rather than its own ad-hoc icons.
 */
const RADIAL_TRACKERS: { id: string; trackerType: TrackerType; itemType: GeneralItemType; labelKey: string }[] = [
   { id: 'status', trackerType: 'STATUS', itemType: 'STATUS_TRACKER', labelKey: 'Trackers.addStatus' },
   { id: 'story-tag', trackerType: 'STORY_TAG', itemType: 'STORY_TAG_TRACKER', labelKey: 'Trackers.addStoryTag' },
   { id: 'story-theme', trackerType: 'STORY_THEME', itemType: 'STORY_THEME_TRACKER', labelKey: 'Trackers.addStoryTheme' },
];

/** The portal create leaf's glyph, from the shared registry so the radial matches the toolbar/menu later. */
const PortalCreateIcon = CREATABLE_BY_KIND.portal.icon;

/** Rebuilds a connection's content with a new style, preserving its endpoints. The style carries
 *  the full set (width + color + dash), so any single-facet edit keeps the others. */
function buildConnectionContent(item: BoardItem | undefined, style: ConnectionStyle): BoardItemContent {
   const content = item?.content;
   const from = content?.kind === 'connection' ? content.from : '';
   const to = content?.kind === 'connection' ? content.to : '';
   return { kind: 'connection', from, to, style };
}

/** Wheel-to-zoom sensitivity: a typical notch (~100 deltaY) is a gentle step. */
const ZOOM_SENSITIVITY = 0.0015;

/** Screen-px margin fit-to-content leaves around the framed items. */
const FIT_PADDING = 64;
/** The grid styles the toolbar control cycles through, in order. */
const GRID_CYCLE: BoardGridType[] = ['dots', 'lines', 'none'];

/**
 * The top-bar scroll arrow: a frosted square overlaid on a scroll edge so the bar's contents slide
 * underneath it. Centered vertically via `my-auto` (not a transform) so framer-motion owns `x` for
 * the slide-in/out; the side (`left-0.5`/`right-0.5`) is appended per arrow.
 */
const BAR_ARROW_CLASS =
   'absolute top-0 bottom-0 z-10 my-auto flex size-7 items-center justify-center rounded border border-border bg-popover/95 text-popover-foreground shadow-md backdrop-blur-sm hover:bg-muted cursor-pointer';

/**
 * Builds the screen-space CSS background for the grid layer: position tracks the pan,
 * size is the adaptive spacing, and the color falls back to `currentColor` (set subtle
 * on the layer) so the grid reads on both themes. `none` draws nothing.
 */
function gridBackground(grid: BoardGrid, spacing: number, viewport: Viewport): CSSProperties {
   if (grid.type === 'none') return {};
   const color = grid.color ?? 'currentColor';
   const position = `${viewport.x}px ${viewport.y}px`;
   const size = `${spacing}px ${spacing}px`;
   if (grid.type === 'dots') {
      return { backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1.5px)`, backgroundSize: size, backgroundPosition: position };
   }
   return {
      backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
      backgroundSize: size,
      backgroundPosition: position,
   };
}

/** The toolbar icon for the current grid style (the button cycles to the next). */
function gridIcon(type: BoardGridType) {
   if (type === 'dots') return <Grip className="h-4 w-4" />;
   if (type === 'lines') return <Grid3x3 className="h-4 w-4" />;
   return <Square className="h-4 w-4" />;
}

/** The canvas; renders nothing when no board tab is active. */
export function BoardView() {
   const instance = useActiveBoardInstance();
   if (!instance) return null;
   return <BoardCanvas store={instance} />;
}

function BoardCanvas({ store }: { store: BoardStore }) {
   const { t } = useTranslation();
   const viewport = useStore(store, (state) => state.viewport);
   const grid = useStore(store, (state) => state.grid);
   const name = useStore(store, (state) => state.name);
   const items = useStore(store, (state) => state.items);
   const actions = useStore(store, (state) => state.actions);

   // Selection is ephemeral: a local set, never persisted or routed through commands.
   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
   const [isPanning, setIsPanning] = useState(false);
   // A Shift+background marquee (null when idle); a plain drag pans instead. Corners are in
   // client coords; the clip origin is captured at start so the overlay + world math never
   // read a ref during render.
   const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number; clipLeft: number; clipTop: number } | null>(null);
   // The live group move: the moving id set + a shared world delta (null when idle).
   const [groupDrag, setGroupDrag] = useState<{ ids: Set<string>; delta: { x: number; y: number } } | null>(null);

   /** Opens the portal restyle editor for `itemId`, anchored at the Edit click. Stable so it never breaks
    *  the item box memoization (every box would otherwise re-render on each pan). */
   const handleRequestEditPortal = useCallback((itemId: string, screen: { x: number; y: number }) => {
      setPortalEditor({ itemId, screen });
   }, []);

   /** Selects an item: `additive` (Shift/Ctrl) toggles it in/out of the set, else it replaces the set. */
   const handleSelect = useCallback((id: string, additive: boolean) => {
      setSelectedIds((prev) => {
         if (!additive) return new Set([id]);
         const next = new Set(prev);
         if (next.has(id)) next.delete(id);
         else next.add(id);
         return next;
      });
   }, []);

   // Cross-surface drop target for dragging a drawer card/tracker onto the canvas. Only
   // mounted on a board tab (BoardView renders nothing otherwise), so it never competes
   // with the sheet drop zones on a character tab. The drop is routed by `handleDragEnd`.
   const { setNodeRef: setDroppableRef } = useDroppable({ id: 'board-drop-zone', data: { type: 'board-drop-zone' } });

   const clipRef = useRef<HTMLDivElement | null>(null);
   // Compose the droppable node ref with the local clip ref (used for the wheel listener
   // and screen->world math, and read by the drop handler via `data-board-clip`).
   const setClipRefs = (node: HTMLDivElement | null) => {
      clipRef.current = node;
      setDroppableRef(node);
   };
   // Mirror the live viewport into a ref so the native wheel listener and pan handlers
   // read the current value without re-subscribing.
   const viewportRef = useRef(viewport);
   useEffect(() => {
      viewportRef.current = viewport;
   }, [viewport]);
   const panStart = useRef<{ x: number; y: number; origX: number; origY: number; zoom: number } | null>(null);

   // The clip's live box (size + viewport offset), so the corner readout and the card popover read it
   // from state, never via the ref during render. The observer captures the rect (in its callback, not
   // the effect body) and fires on observe(), so the first measure lands without a synchronous setState.
   const [clipRect, setClipRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
   useEffect(() => {
      const el = clipRef.current;
      if (!el) return;
      const observer = new ResizeObserver(() => {
         const box = el.getBoundingClientRect();
         setClipRect({ left: box.left, top: box.top, width: box.width, height: box.height });
      });
      observer.observe(el);
      return () => observer.disconnect();
   }, []);
   // The world point at the clip's center, for the corner readout. Origin cancels for the centre, so
   // it derives from the live viewport + clip size alone (no layout read during render).
   const viewCenter = screenToWorld(clipRect.width / 2, clipRect.height / 2, { left: 0, top: 0 }, viewport);
   // Reset-view places the world origin at the clip's center (so the readout reads 0, 0), not the
   // top-left corner that a zero offset would give.
   const originViewport = (): Viewport => ({ x: clipRect.width / 2, y: clipRect.height / 2, zoom: 1 });

   // The in-progress connect drag (preview line follows the cursor in world coords).
   const [connectPreview, setConnectPreview] = useState<{ fromId: string; cursor: Point } | null>(null);

   const sortedItems = Object.values(items).sort((a, b) => a.z - b.z);
   // Connections render in the SVG overlay; everything else renders as a positioned box.
   const spatialItems = sortedItems.filter((item) => item.kind !== 'connection');
   const connectionItems = sortedItems.filter((item) => item.kind === 'connection');
   // Zones are background frames: their tinted rectangles render in a back layer (behind every
   // other item) while their header + chrome render in a front pass (on top). Non-zone items
   // render in between, so they sit on top of a zone but under its chrome.
   const zoneItems = spatialItems.filter((item) => item.kind === 'zone');
   // Collapsed zones shrink to a bar and hide their members: members keep their store position but
   // aren't painted, and connections touching them re-anchor to the bar (handled in the layer).
   const collapsedZoneIds = new Set(zoneItems.filter((item) => item.content.kind === 'zone' && item.content.collapsed).map((item) => item.id));
   const nonZoneItems = spatialItems.filter((item) => item.kind !== 'zone' && !(item.zoneId && collapsedZoneIds.has(item.zoneId)));

   // The behind-items DOM node zones portal their tinted backgrounds into (first child of the
   // world layer, so it paints behind the item boxes). State-backed like the toolbar slots.
   const [backLayer, setBackLayer] = useState<HTMLDivElement | null>(null);

   // The open right-click radial menu: the cursor's screen point (positions the ring) + its world
   // point (where a create action drops the new item). Null when closed.
   const [radial, setRadial] = useState<{ screen: { x: number; y: number }; world: Point } | null>(null);

   // A pending board card creation: the chosen game, the world point to drop at, and the screen point
   // the creation window opens at (near the toolbar when menu-triggered, the cursor from the radial).
   // Null when closed.
   const [pendingCard, setPendingCard] = useState<{ game: GameSystem; world: Point; screen: { x: number; y: number } } | null>(null);

   // The target picker: anchored at `screen`. On CREATE it drops a new portal at `world`; on RETARGET
   // (`retargetItemId` set, opened from the editor) it swaps that portal's target and keeps its style. Null
   // when closed. A portal picks its target FIRST, then drops styled.
   const [portalPicker, setPortalPicker] = useState<{ world: Point; screen: { x: number; y: number }; retargetItemId?: string } | null>(null);

   // The open portal restyle editor: the item being edited + the screen point its window opens at (the Edit
   // click). Null when closed. The window itself is a `BoardFloatingWindow` rendered below.
   const [portalEditor, setPortalEditor] = useState<{ itemId: string; screen: { x: number; y: number } } | null>(null);

   // ==================
   //  Top bar overflow scroll UX (mirrors the tab strip: wheel scrolls, hidden scrollbar, edge arrows)
   // ==================
   const barScrollRef = useRef<HTMLDivElement | null>(null);
   const barContentRef = useRef<HTMLDivElement | null>(null);
   const [barCanScrollLeft, setBarCanScrollLeft] = useState(false);
   const [barCanScrollRight, setBarCanScrollRight] = useState(false);

   /** Recomputes whether the bar overflows left/right, to drive the edge arrows. */
   const updateBarScroll = useCallback(() => {
      const el = barScrollRef.current;
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setBarCanScrollLeft(scrollLeft > 0);
      setBarCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth); // ceil: ignore sub-pixel rounding
   }, []);

   // A vertical wheel scrolls the bar horizontally (only when it overflows, so the page/canvas keeps
   // its wheel otherwise). Native listener so it can preventDefault (React's onWheel is passive). The
   // arrows track scrolling, the bar resizing, and the title/content growing (observe both elements).
   useEffect(() => {
      const el = barScrollRef.current;
      if (!el) return;
      updateBarScroll();
      const onWheel = (event: WheelEvent) => {
         // The bar consumes the wheel (never lets it reach the canvas zoom), and scrolls itself
         // horizontally when it overflows.
         event.stopPropagation();
         if (el.scrollWidth <= el.clientWidth) return;
         el.scrollLeft += event.deltaY;
         event.preventDefault();
      };
      el.addEventListener('scroll', updateBarScroll, { passive: true });
      el.addEventListener('wheel', onWheel, { passive: false });
      const observer = new ResizeObserver(updateBarScroll);
      observer.observe(el);
      if (barContentRef.current) observer.observe(barContentRef.current);
      return () => {
         el.removeEventListener('scroll', updateBarScroll);
         el.removeEventListener('wheel', onWheel);
         observer.disconnect();
      };
   }, [updateBarScroll]);

   /** Scrolls the bar toward one side by ~80% of its visible width. */
   const scrollBarBy = useCallback((direction: -1 | 1) => {
      const el = barScrollRef.current;
      if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
   }, []);

   /** Converts an absolute cursor point to world coords via the live clip rect + viewport. */
   const cursorToWorld = useCallback((clientX: number, clientY: number): Point | null => {
      const el = clipRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return screenToWorld(clientX, clientY, { left: rect.left, top: rect.top }, viewportRef.current);
   }, []);

   /** Deletes one item plus the connections referencing it (cascade + dedupe), as one undo step. */
   const handleDelete = useCallback(
      (id: string) => {
         void actions.deleteItems([id]);
         setSelectedIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
         });
      },
      [actions],
   );

   /** Deletes the whole selection (with connection cascade) as one undo step, then clears it. */
   const handleDeleteSelection = useCallback(() => {
      if (selectedIds.size === 0) return;
      void actions.deleteItems([...selectedIds]);
      setSelectedIds(new Set());
   }, [actions, selectedIds]);

   /** Duplicates the selection (copies + in-selection connections, offset), then selects the copies. */
   const handleDuplicateSelection = useCallback(async () => {
      if (selectedIds.size === 0) return;
      const newIds = await actions.duplicateItems([...selectedIds]);
      setSelectedIds(new Set(newIds));
   }, [actions, selectedIds]);

   /**
    * Starts a group move from an item's move grip (canvas-owned, like the connect drag).
    * The whole selection moves if the grabbed item is in it; otherwise it selects just that
    * item and moves it alone. A shared world delta renders live; one compound command on release.
    */
   const handleMoveStart = useCallback(
      (id: string, event: ReactPointerEvent) => {
         if (event.button !== 0) return; // right-click is for the radial menu, not a move
         const base = selectedIds.has(id) ? new Set(selectedIds) : new Set([id]);
         if (!selectedIds.has(id)) setSelectedIds(base);

         // Expand the move set with every member of any zone in it, so a zone carries its contents.
         // `reevaluate` is the directly-grabbed non-zone items (their membership is recomputed on
         // release); members pulled in by a moved zone are excluded so they stay in the zone.
         const liveItems = store.getState().items;
         const ids = new Set(base);
         for (const baseId of base) {
            if (liveItems[baseId]?.kind !== 'zone') continue;
            for (const candidate of Object.values(liveItems)) if (candidate.zoneId === baseId) ids.add(candidate.id);
         }
         const reevaluate = [...base].filter((baseId) => liveItems[baseId] && liveItems[baseId].kind !== 'zone');

         const startX = event.clientX;
         const startY = event.clientY;
         const zoom = viewportRef.current.zoom;
         let delta = { x: 0, y: 0 };
         let moved = false;

         const onMove = (moveEvent: PointerEvent) => {
            delta = screenDeltaToWorld(moveEvent.clientX - startX, moveEvent.clientY - startY, zoom);
            if (delta.x !== 0 || delta.y !== 0) moved = true;
            setGroupDrag({ ids, delta });
         };
         const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            setGroupDrag(null);
            if (moved) void actions.moveItems([...ids], delta, reevaluate);
         };
         window.addEventListener('pointermove', onMove);
         window.addEventListener('pointerup', onUp);
         setGroupDrag({ ids, delta });
      },
      [actions, selectedIds, store],
   );

   /**
    * Starts a connect drag from an item's connect handle: a preview line follows the
    * cursor, and a release over a different item creates a connection (otherwise cancel).
    * Custom pointer handling (window listeners), not dnd-kit.
    */
   const handleConnectStart = useCallback(
      (fromId: string, event: ReactPointerEvent) => {
         if (event.button !== 0) return; // right-click is for the radial menu, not a connect drag
         const start = cursorToWorld(event.clientX, event.clientY);
         setConnectPreview({ fromId, cursor: start ?? { x: 0, y: 0 } });

         const onMove = (moveEvent: PointerEvent) => {
            const world = cursorToWorld(moveEvent.clientX, moveEvent.clientY);
            if (world) setConnectPreview({ fromId, cursor: world });
         };
         const onUp = (upEvent: PointerEvent) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            setConnectPreview(null);

            const hit = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
            const targetId = hit instanceof Element ? hit.closest('[data-board-item-id]')?.getAttribute('data-board-item-id') ?? null : null;
            const liveItems = store.getState().items;
            if (targetId && targetId !== fromId) {
               const target = liveItems[targetId];
               if (target && target.kind !== 'connection') {
                  const zValues = Object.values(liveItems).map((item) => item.z);
                  const z = zValues.length > 0 ? Math.max(...zValues) + 1 : 0;
                  void actions.addItem({
                     id: cuid(),
                     kind: 'connection',
                     x: 0, y: 0, width: 0, height: 0, z,
                     content: { kind: 'connection', from: fromId, to: targetId, style: { ...DEFAULT_CONNECTION_STYLE } },
                  });
               }
            }
         };
         window.addEventListener('pointermove', onMove);
         window.addEventListener('pointerup', onUp);
      },
      [cursorToWorld, store, actions],
   );

   // ==================
   //  Zoom (native, non-passive wheel so it can preventDefault the page scroll)
   // ==================
   useEffect(() => {
      const el = clipRef.current;
      if (!el) return;
      const onWheel = (event: WheelEvent) => {
         // A selected, scrollable note (post-it/journal) marks its body for native scroll: let the wheel
         // scroll it instead of zooming the board - no preventDefault, so the textarea scrolls natively.
         const target = event.target;
         if (target instanceof Element && target.closest('[data-board-wheel-scroll]')) return;
         const rect = el.getBoundingClientRect();
         const vp = viewportRef.current;
         const factor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY);
         actions.setViewport(zoomToCursor(vp, { left: rect.left, top: rect.top }, event.clientX, event.clientY, vp.zoom * factor));
         event.preventDefault();
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
   }, [actions]);

   // ==================
   //  Keyboard: delete / duplicate the selection (ignored while editing text)
   // ==================
   useEffect(() => {
      if (selectedIds.size === 0) return;
      const onKeyDown = (event: KeyboardEvent) => {
         const target = event.target;
         if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
         if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            handleDeleteSelection();
         } else if ((event.ctrlKey || event.metaKey) && (event.key === 'd' || event.key === 'D')) {
            event.preventDefault();
            void handleDuplicateSelection();
         }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
   }, [selectedIds, handleDeleteSelection, handleDuplicateSelection]);

   // ==================
   //  Pan (background drag) + background click clears selection
   // ==================
   const handleBackgroundPointerDown = (event: ReactPointerEvent) => {
      // Only the primary button pans/marquees; a right-click is reserved for the radial menu.
      if (event.button !== 0) return;
      if (event.shiftKey) {
         // Shift+drag is a marquee, not a pan; it keeps the current selection (additive).
         const clip = event.currentTarget.getBoundingClientRect();
         setMarquee({ x0: event.clientX, y0: event.clientY, x1: event.clientX, y1: event.clientY, clipLeft: clip.left, clipTop: clip.top });
         event.currentTarget.setPointerCapture(event.pointerId);
         return;
      }
      // A plain background drag pans and clears the selection.
      setSelectedIds(new Set());
      const vp = viewportRef.current;
      panStart.current = { x: event.clientX, y: event.clientY, origX: vp.x, origY: vp.y, zoom: vp.zoom };
      setIsPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleBackgroundPointerMove = (event: ReactPointerEvent) => {
      if (marquee) {
         setMarquee((current) => (current ? { ...current, x1: event.clientX, y1: event.clientY } : null));
         return;
      }
      const start = panStart.current;
      if (!start) return;
      // Pan is in raw screen px (the world translate is applied before the scale).
      actions.setViewport({ x: start.origX + (event.clientX - start.x), y: start.origY + (event.clientY - start.y), zoom: start.zoom });
   };

   const handleBackgroundPointerUp = (event: ReactPointerEvent) => {
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (marquee) {
         // Ignore a tiny shift-click (no real drag) so it never selects under the point.
         const dragged = Math.abs(marquee.x1 - marquee.x0) >= 3 || Math.abs(marquee.y1 - marquee.y0) >= 3;
         if (dragged) {
            const origin = { left: marquee.clipLeft, top: marquee.clipTop };
            const a = screenToWorld(marquee.x0, marquee.y0, origin, viewportRef.current);
            const b = screenToWorld(marquee.x1, marquee.y1, origin, viewportRef.current);
            const hits = itemsInMarquee(Object.values(store.getState().items), {
               minX: Math.min(a.x, b.x),
               minY: Math.min(a.y, b.y),
               maxX: Math.max(a.x, b.x),
               maxY: Math.max(a.y, b.y),
            });
            setSelectedIds((prev) => new Set([...prev, ...hits]));
         }
         setMarquee(null);
         return;
      }
      panStart.current = null;
      setIsPanning(false);
   };

   // ==================
   //  Toolbar actions
   // ==================
   /**
    * Creates a new item of `kind` centered on `worldCenter`, joining a zone it lands in, then selects it.
    * `contentOverride` lets a picker-first kind (a portal) supply its already-targeted content instead of the
    * registry's empty factory; everything else about the placement/z/zone/select path is identical.
    */
   const createItemAt = (kind: CreatableKind, worldCenter: Point, contentOverride?: BoardItemContent) => {
      const zValues = sortedItems.map((item) => item.z);
      const z = zValues.length > 0 ? Math.max(...zValues) + 1 : 0;
      const size = CREATABLE_BY_KIND[kind].defaultSize;
      const id = cuid();
      const placement = { id, x: worldCenter.x - size.width / 2, y: worldCenter.y - size.height / 2, width: size.width, height: size.height };
      // A non-zone item created over a zone joins it (same center-in-rectangle rule as a drop).
      const zoneId = kind === 'zone' ? undefined : zoneContaining(placement, zoneItems) ?? undefined;
      void actions.addItem({ ...placement, kind, z, zoneId, content: contentOverride ?? CREATABLE_BY_KIND[kind].makeContent() });
      setSelectedIds(new Set([id]));
   };

   /** Drops a portal (target picked in the list) at `worldCenter` with the smart-default icon+text style. */
   const createPortalAt = (target: PortalTarget, defaultName: string, worldCenter: Point) => {
      createItemAt('portal', worldCenter, makePortalContent(target, defaultName));
   };

   /** The portal picker's pick handler: classifies the row to a portal target, then drops (create) or swaps
    *  the target of an existing portal (retarget, keeping its style + label), then closes. */
   const handlePortalPick = (target: LinkInsertTarget, defaultName: string) => {
      if (!portalPicker) return;
      const portalTarget = portalTargetFromInsert(target);
      if (!portalTarget) return; // a section row (note-only) is never offered here.
      if (portalPicker.retargetItemId) {
         const existing = store.getState().items[portalPicker.retargetItemId];
         if (existing && existing.content.kind === 'portal') {
            void actions.updateItemContent(existing.id, { ...existing.content, target: portalTarget });
         }
      } else {
         createPortalAt(portalTarget, defaultName, portalPicker.world);
      }
      setPortalPicker(null);
   };

   /** Opens the portal target picker for a menu/palette create (no cursor point): drop at the view center, window near the top-left. */
   const openPortalPickerAtViewCenter = () => {
      const rect = clipRef.current?.getBoundingClientRect();
      if (!rect) { setPortalPicker({ world: viewCenter, screen: { x: 0, y: 0 } }); return; }
      const world = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2, { left: rect.left, top: rect.top }, viewportRef.current);
      setPortalPicker({ world, screen: { x: rect.left + BOARD_WINDOW_MARGIN, y: rect.top + BOARD_WINDOW_MARGIN } });
   };

   /**
    * Commits a portal STYLE edit as one undoable command, reading the item LIVE at commit time and patching
    * only its style - so a deferred label flush can't clobber a target/visual change made meanwhile (and vice
    * versa). No-op if the item is gone or is no longer a portal.
    */
   const commitPortalStyle = useCallback(
      (itemId: string, updater: (style: PortalStyle) => PortalStyle) => {
         const live = store.getState().items[itemId];
         if (!live || live.content.kind !== 'portal') return;
         void actions.updateItemContent(itemId, { ...live.content, style: updater(live.content.style) });
      },
      [store, actions],
   );

   /**
    * Creates a fresh, game-agnostic tracker at `worldCenter`: a board-native COPY (no drawer source),
    * sized to the tracker's native footprint, then selects it. It renders through the interactive
    * embed host (a NEUTRAL synthetic character), so it's app-themed and editable with no extra wiring.
    */
   const createTrackerAt = (trackerType: TrackerType, worldCenter: Point) => {
      const zValues = sortedItems.map((item) => item.z);
      const z = zValues.length > 0 ? Math.max(...zValues) + 1 : 0;
      const size = EMBEDDED_TRACKER_SIZES[trackerType];
      const id = cuid();
      const placement = { id, x: worldCenter.x - size.width / 2, y: worldCenter.y - size.height / 2, width: size.width, height: size.height };
      const zoneId = zoneContaining(placement, zoneItems) ?? undefined;
      void actions.addItem({ ...placement, kind: 'tracker', z, zoneId, content: { kind: 'tracker', mode: 'copy', data: emptyTracker(trackerType) } });
      setSelectedIds(new Set([id]));
   };

   /**
    * Creates a card from the dialog's options at `worldCenter`: a board-native COPY (no drawer source)
    * of the chosen game, sized to the card's native footprint, then selects it. The embed host seeds
    * the synthetic character with the card's own game, so it themes by that game (not NEUTRAL).
    */
   const createCardAt = (game: GameSystem, options: CreateCardOptions, worldCenter: Point) => {
      const card = buildCard(game, options);
      if (!card) return;
      const zValues = sortedItems.map((item) => item.z);
      const z = zValues.length > 0 ? Math.max(...zValues) + 1 : 0;
      const { width, height } = EMBEDDED_CARD_SIZE;
      const id = cuid();
      const placement = { id, x: worldCenter.x - width / 2, y: worldCenter.y - height / 2, width, height };
      const zoneId = zoneContaining(placement, zoneItems) ?? undefined;
      void actions.addItem({ ...placement, kind: 'card', z, zoneId, content: { kind: 'card', mode: 'copy', data: card } });
      setSelectedIds(new Set([id]));
   };

   /**
    * Mints a fresh Challenge Card at `worldCenter`: a board-native COPY (no drawer source, no creation
    * form - a challenge has none of the theme wizardry), selected AND dropped straight into its Expanded
    * display mode so a GM goes from "wants a threat" to typing its name with no extra click. Expanded is
    * a persisted card field, so the item keeps its stored portrait footprint for when it collapses back.
    */
   const createChallengeAt = (worldCenter: Point) => {
      const card = buildCard('LEGENDS', { cardType: 'CHALLENGE_CARD', powerTagsCount: 0, weaknessTagsCount: 0 });
      if (!card) return;
      const zValues = sortedItems.map((item) => item.z);
      const z = zValues.length > 0 ? Math.max(...zValues) + 1 : 0;
      const { width, height } = EMBEDDED_CARD_SIZE;
      const id = cuid();
      const placement = { id, x: worldCenter.x - width / 2, y: worldCenter.y - height / 2, width, height };
      const zoneId = zoneContaining(placement, zoneItems) ?? undefined;
      void actions.addItem({ ...placement, kind: 'card', z, zoneId, content: { kind: 'card', mode: 'copy', data: { ...card, expanded: true } } });
      setSelectedIds(new Set([id]));
   };

   /**
    * Embeds a saved note at `worldCenter` as a live reference tile: loads the drawer NOTE item and builds
    * the SAME reference spec the drag-drop path uses ({@link embeddedSpecForDrawerItem}), then drops + selects
    * it. Async (a drawer read); a deleted source no-ops. Keyed on the note's drawer item id (from the picker).
    */
   const embedNoteAt = (drawerItemId: string, worldCenter: Point) => {
      void getItem(drawerItemId).then((item) => {
         if (!item) return;
         const spec = embeddedSpecForDrawerItem(item);
         if (!spec) return;
         const zValues = sortedItems.map((existing) => existing.z);
         const z = zValues.length > 0 ? Math.max(...zValues) + 1 : 0;
         const id = cuid();
         const placement = { id, x: worldCenter.x - spec.width / 2, y: worldCenter.y - spec.height / 2, width: spec.width, height: spec.height };
         const zoneId = zoneContaining(placement, zoneItems) ?? undefined;
         void actions.addItem({ ...placement, kind: spec.kind, z, zoneId, content: spec.content });
         setSelectedIds(new Set([id]));
      });
   };

   const { clearBoardAction, setDrawerOpen } = useAppGeneralStateActions();

   /*
    * Saves the sole-selected item to the drawer via the same orchestration the toolbar affordances run.
    * A copy card/tracker: `asNew` = Save As, else Save with a transparent Save-As fallback for a dangling
    * source. An image is Save-As only (mint an IMAGE_CARD, no source to write back to), so a Save request
    * on an image transparently mints too - mirroring a source-less card. The canvas owns the selection, so
    * the palette routes here rather than reaching into board state. No-op with an explanatory toast when
    * nothing usable is selected; the remaining kinds (pin/post-it/journal/character ref) have no drawer
    * save yet.
    */
   const saveSelectedItemToDrawer = (asNew: boolean) => {
      const id = selectedIds.size === 1 ? [...selectedIds][0] : null;
      const item = id ? items[id] : undefined;
      const content = item?.content;
      if (!content) {
         toast.error(t('Notifications.board.itemNotSaveable'));
         return;
      }

      const drawerState = useDrawerStore.getState();
      const baseDeps = {
         t,
         drawerCurrentFolderId: drawerState.currentFolderId,
         isDrawerOpen: useAppGeneralStateStore.getState().isDrawerOpen,
         setDrawerOpen,
      };

      // A board image is mint-only (no source, no adopt); Save and Save As both mint an IMAGE_CARD.
      if (content.kind === 'image') {
         runSaveImageToDrawerAs(content, baseDeps);
         return;
      }

      if ((content.kind !== 'card' && content.kind !== 'tracker' && content.kind !== 'post-it' && content.kind !== 'journal') || content.mode !== 'copy') {
         toast.error(t('Notifications.board.itemNotSaveable'));
         return;
      }
      const deps = {
         ...baseDeps,
         onAdoptSource: (sourceDrawerItemId: string) => { void actions.adoptItemDrawerSource(id!, sourceDrawerItemId); },
      };
      if (asNew) runSaveItemToDrawerAs(content, deps);
      else void runSaveItemToDrawer(content, deps);
   };

   // The command palette has no cursor point to drop at and doesn't know the selection, so it requests
   // actions through this one-shot store signal instead; the active board consumes it against its own
   // view center / selection and clears it. Runs only while this canvas is mounted, so it can't fire on
   // a background board.
   const pendingBoardAction = useAppGeneralStateStore((state) => state.pendingBoardAction);
   useEffect(() => {
      if (!pendingBoardAction) return;
      if (pendingBoardAction === 'createChallenge') createChallengeAt(viewCenter);
      else if (pendingBoardAction === 'saveItemToDrawer') saveSelectedItemToDrawer(false);
      else if (pendingBoardAction === 'saveItemToDrawerAs') saveSelectedItemToDrawer(true);
      else if (pendingBoardAction.startsWith('create:')) {
         const kind = pendingBoardAction.slice('create:'.length) as CreatableKind;
         // A picker-first kind (a portal) opens its target picker instead of dropping a targetless item.
         if (CREATABLE_BY_KIND[kind]?.requiresPicker) openPortalPickerAtViewCenter();
         else createItemAt(kind, viewCenter);
      }
      else if (pendingBoardAction.startsWith('embedNote:')) embedNoteAt(pendingBoardAction.slice('embedNote:'.length), viewCenter);
      clearBoardAction();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- the handlers close over live selection/viewCenter that change every render; only the action id should re-trigger this.
   }, [pendingBoardAction, clearBoardAction]);

   /** Palette add: drop the new item centered in the current view (the radial uses the cursor point). */
   const handleAddItem = (kind: CreatableKind) => {
      createItemAt(kind, currentViewCenter());
   };

   /** The current view's world center + the clip's center screen point (for a menu-driven create/anchor). */
   const currentViewCenter = (): Point => {
      const el = clipRef.current;
      if (!el) return viewCenter;
      const rect = el.getBoundingClientRect();
      return screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2, { left: rect.left, top: rect.top }, viewportRef.current);
   };

   /**
    * The "Add Game Element" menu's card row: open the card creation window for `game`. The drop still
    * lands at the view center on confirm, but the window opens near the toolbar (upper-left) rather than
    * mid-canvas - the menu isn't cursor-placed, so a mid-canvas panel would cover the drop point.
    */
   const handlePickCardGame = (game: GameSystem) => {
      const el = clipRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const world = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2, { left: rect.left, top: rect.top }, viewportRef.current);
      const screen = { x: rect.left + 12, y: rect.top + 56 }; // just below the top-left toolbar
      setPendingCard({ game, world, screen });
   };

   /**
    * Right-click opens the radial menu at the cursor (create-at-cursor + selection actions). Over a
    * text field it does nothing, leaving the native edit menu; right-clicking an unselected item
    * selects it first so the selection actions target it (empty canvas keeps the current selection).
    */
   const handleContextMenu = (event: ReactMouseEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      event.preventDefault();
      const itemId = target instanceof Element ? target.closest('[data-board-item-id]')?.getAttribute('data-board-item-id') ?? null : null;
      if (itemId && !selectedIds.has(itemId)) setSelectedIds(new Set([itemId]));
      const world = cursorToWorld(event.clientX, event.clientY);
      if (!world) return;
      setRadial({ screen: { x: event.clientX, y: event.clientY }, world });
   };

   /** Frames every spatial item, centered and zoom-clamped (origin when the board is empty). */
   const handleFitToContent = () => {
      const el = clipRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      actions.setViewport(fitViewport(Object.values(items), { width: rect.width, height: rect.height }, FIT_PADDING));
   };

   /** Cycles the background grid: dots -> lines -> none. */
   const handleCycleGrid = () => {
      const next = GRID_CYCLE[(GRID_CYCLE.indexOf(grid.type) + 1) % GRID_CYCLE.length];
      void actions.setGrid({ ...grid, type: next });
   };

   // Derived selection chrome. One selected -> the per-item toolbar; the live group-move
   // delta applies to every item in the active drag.
   const soleSelectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
   const moveDeltaFor = (id: string) => (groupDrag && groupDrag.ids.has(id) ? groupDrag.delta : null);

   // Two+ selected spatial items -> a group toolbar over their bounding box (shifted live
   // during a group move). Connections (zero-size) don't anchor it.
   const groupBbox = (() => {
      if (selectedIds.size < 2) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, count = 0;
      for (const id of selectedIds) {
         const item = items[id];
         if (!item || item.kind === 'connection') continue;
         const delta = moveDeltaFor(id) ?? { x: 0, y: 0 };
         minX = Math.min(minX, item.x + delta.x);
         minY = Math.min(minY, item.y + delta.y);
         maxX = Math.max(maxX, item.x + item.width + delta.x);
         maxY = Math.max(maxY, item.y + item.height + delta.y);
         count++;
      }
      return count >= 2 ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
   })();

   // Every non-connection item renders in ONE stable pass; selection raises an item via z-index, not
   // a DOM re-order, so its React instance is preserved (no remount -> edits commit on blur, images
   // don't reload). A selected item still renders full front-row (above other items AND the connection
   // layer) - here that's a z-index band, not a later pass. `rank` is the item's index in stored-z
   // order, feeding the disjoint bands in `boardLayering`. Render-only: stored z is untouched.
   const layerRank = new Map(spatialItems.map((item, index) => [item.id, index]));
   const layerCount = spatialItems.length;

   /** Renders one item box. Shared by the non-zone and zone passes; zones use `backLayer` for their background. */
   const renderBox = (item: BoardItem) => {
      // A zone carries its member count (collapsed-bar badge) and a resize floor (the extent of its
      // members), so it can't be dragged smaller than it encloses; other kinds floor at MIN_ITEM_SIZE.
      const members = item.kind === 'zone' ? Object.values(items).filter((other) => other.zoneId === item.id) : null;
      return (
         <BoardItemBox
            key={item.id}
            item={item}
            isSelected={selectedIds.has(item.id)}
            soleSelected={item.id === soleSelectedId}
            zIndex={itemZIndex(layerRank.get(item.id) ?? 0, selectedIds.has(item.id), layerCount)}
            memberCount={members?.length}
            resizeMin={members ? zoneContentMinSize(item, members) : item.kind === 'portal' ? PORTAL_MIN_SIZE : undefined}
            zoom={viewport.zoom}
            moveDelta={moveDeltaFor(item.id)}
            isMoving={!!groupDrag && groupDrag.ids.has(item.id)}
            onSelect={handleSelect}
            onMoveStart={handleMoveStart}
            onResize={actions.resizeItem}
            onSyncSize={actions.syncItemSize}
            onUpdateContent={actions.updateItemContent}
            onCacheLastKnown={actions.cacheReferenceLastKnown}
            onAdoptSource={actions.adoptItemDrawerSource}
            onBringToFront={actions.bringToFront}
            onSendToBack={actions.sendToBack}
            onDelete={handleDelete}
            onConnectStart={handleConnectStart}
            onRequestEditPortal={handleRequestEditPortal}
            backLayer={backLayer}
         />
      );
   };

   // The radial's node tree: a "New" submenu holding the per-kind create leaves (each placed at the
   // click), plus duplicate + delete leaves at the root when something is selected. Built only while
   // the menu is open. The root stays lean - it grows later via the same tree.
   const radialRoot: RadialNode[] = radial
      ? [
           {
              id: 'new-board',
              icon: <Plus className="h-5 w-5" />,
              label: t('BoardView.radialNewBoardElement'),
              children: [
                 // Immediate one-click creates; a picker-first kind (a portal) is offered as its own leaf below.
                 ...CREATABLE_REGISTRY.filter(({ requiresPicker }) => !requiresPicker).map(({ kind, icon: Icon, labelKey }) => ({
                    id: kind,
                    icon: <Icon className="h-5 w-5" />,
                    label: t(`BoardView.${labelKey}`),
                    onSelect: () => createItemAt(kind, radial.world),
                 })),
                 {
                    // Ellipsis label: picking a target follows before the portal drops.
                    id: 'portal',
                    icon: <PortalCreateIcon className="h-5 w-5" />,
                    label: t('BoardView.addPortal'),
                    onSelect: () => setPortalPicker({ world: radial.world, screen: radial.screen }),
                 },
              ],
           },
           {
              id: 'new-sheet',
              icon: <FilePlus2 className="h-5 w-5" />,
              label: t('BoardView.radialNewSheetElement'),
              children: [
                 {
                    id: 'trackers',
                    icon: <ListChecks className="h-5 w-5" />,
                    label: t('BoardView.radialTrackers'),
                    children: RADIAL_TRACKERS.map(({ id, trackerType, itemType, labelKey }) => {
                       const Icon = getItemTypeIconComponent(itemType);
                       return { id, icon: <Icon className="h-5 w-5" />, label: t(labelKey), onSelect: () => createTrackerAt(trackerType, radial.world) };
                    }),
                 },
                 {
                    id: 'cards',
                    icon: <LayoutGrid className="h-5 w-5" />,
                    label: t('BoardView.radialCards'),
                    children: GAME_CARD_OPTIONS.map(({ game }) => {
                       const { Icon } = GAME_VISUALS[game];
                       return {
                          id: `card-${game}`,
                          icon: <Icon className="h-5 w-5" />,
                          label: t(`Drawer.Types.${game}`),
                          // Open the creation popover for that game; the drop happens on confirm.
                          onSelect: () => setPendingCard({ game, world: radial.world, screen: radial.screen }),
                       };
                    }),
                 },
                 {
                    // A peer leaf, not nested under a game: a challenge is always LEGENDS-flavored (no
                    // theme wizardry to configure), so it drops immediately - no creation popover.
                    id: 'challenge',
                    icon: <Skull className="h-5 w-5" />,
                    label: t('BoardView.addChallenge'),
                    onSelect: () => createChallengeAt(radial.world),
                 },
              ],
           },
           ...(selectedIds.size > 0
              ? [
                   { id: 'duplicate', icon: <Copy className="h-5 w-5" />, label: t('BoardView.duplicateSelection'), onSelect: () => void handleDuplicateSelection() },
                   { id: 'delete', icon: <Trash2 className="h-5 w-5" />, label: t('BoardView.deleteSelection'), destructive: true, onSelect: handleDeleteSelection },
                ]
              : []),
        ]
      : [];

   return (
      <>
      <div
         ref={setClipRefs}
         data-board-clip
         onPointerDown={handleBackgroundPointerDown}
         onPointerMove={handleBackgroundPointerMove}
         onPointerUp={handleBackgroundPointerUp}
         onContextMenu={handleContextMenu}
         className={cn('absolute inset-0 overflow-hidden bg-muted/10', isPanning ? 'cursor-grabbing' : 'cursor-grab')}
      >
         {/* Grid layer: a screen-space CSS background behind everything. Never interactive,
             so it can't eat a pan or a click. The subtle text color feeds `currentColor`. */}
         <div className="pointer-events-none absolute inset-0 text-foreground/15" style={gridBackground(grid, gridSpacing(viewport.zoom), viewport)} />

         {/* Empty-board cue: a quiet, screen-centered hint so a blank canvas reads as "ready",
             not "broken". Screen-space (not the world layer), so it stays put under pan/zoom, and
             inert so it never eats a pan, a background click, or a drawer drop. Gone at one item. */}
         {Object.keys(items).length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
               <LayoutGrid className="h-10 w-10 opacity-50" />
               <p className="text-sm font-medium">{t('BoardView.emptyTitle')}</p>
               <p className="max-w-xs text-xs opacity-80">{t('BoardView.emptyHint')}</p>
            </div>
         )}

         {/* World layer: a single transform maps world coords to screen. */}
         <div className="absolute left-0 top-0" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }}>
            {/* Behind-items layer: zones portal their tinted rectangles here. An explicit z-index 0
                keeps it behind every item box (which sit at band 1+). Inert; the rects handle clicks. */}
            <div ref={setBackLayer} className="absolute left-0 top-0" style={{ zIndex: BACK_LAYER_Z_INDEX }} />

            {/* All non-connection items in ONE pass (never split by selection - no remount). Each box
                carries its z-index band: unselected below the connection layer, selected above it.
                Zones share the same banding (their tinted rect stays behind in the back layer). */}
            {nonZoneItems.map(renderBox)}
            {zoneItems.map(renderBox)}

            {/* Group toolbar over the multi-selection's bounding box (per-item bars suppressed). It
                tops every band so it floats above its members and the connection layer. */}
            {groupBbox && (
               <div className="absolute" style={{ left: groupBbox.x, top: groupBbox.y, width: groupBbox.width, height: groupBbox.height, zIndex: groupToolbarZIndex(layerCount) }}>
                  <BoardGroupToolbar
                     zoom={viewport.zoom}
                     isMoving={!!groupDrag}
                     onMoveStart={(event) => {
                        const anchor = [...selectedIds][0];
                        if (anchor) handleMoveStart(anchor, event);
                     }}
                     onDuplicate={() => void handleDuplicateSelection()}
                     onDelete={handleDeleteSelection}
                  />
               </div>
            )}

            {/* Connections (+ the connect-drag preview) sit at the connection band (z N+1): above every
                unselected item, below every selected one - so a string to a selected item runs behind
                its face. Highlighted only when it is the sole selection (groups are about spatial items). */}
            <BoardConnectionsLayer
               items={items}
               connections={connectionItems}
               selectedId={soleSelectedId}
               zoom={viewport.zoom}
               moving={groupDrag}
               collapsedZoneIds={collapsedZoneIds}
               connectPreview={connectPreview}
               zIndex={connectionsZIndex(layerCount)}
               onSelect={(id) => handleSelect(id, false)}
               onUpdateStyle={(id, style) => void actions.updateItemContent(id, buildConnectionContent(items[id], style))}
               onDelete={handleDelete}
            />
         </div>

         {/* Marquee rectangle: a screen-space overlay (not the world layer), drawn while a
             Shift+background drag is in progress. Inert so it never interferes with the drag. */}
         {marquee && (
            <div
               className="pointer-events-none absolute border border-primary bg-primary/10"
               style={{
                  left: Math.min(marquee.x0, marquee.x1) - marquee.clipLeft,
                  top: Math.min(marquee.y0, marquee.y1) - marquee.clipTop,
                  width: Math.abs(marquee.x1 - marquee.x0),
                  height: Math.abs(marquee.y1 - marquee.y0),
               }}
            />
         )}

         {/* Single top-left bar: the board name leads, then the palette + view controls. It grows to
             fit the title and, when its contents exceed the canvas, scrolls horizontally inside (capped
             at the canvas width minus its margins) - the wheel scrolls it, the scrollbar is hidden, and
             edge arrows appear per side (like the tab strip). Stops the pointer so editing the title or
             scrolling the bar never pans. `overflow-x-clip` clips a slide-out arrow at the card edge. */}
         <div
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute left-3 top-3 flex w-fit max-w-[calc(100%-1.5rem)] items-center overflow-x-clip rounded-md border border-border bg-card/90 shadow-sm backdrop-blur-sm"
         >
            <AnimatePresence>
               {barCanScrollLeft && (
                  <motion.button
                     key="bar-scroll-left"
                     type="button"
                     onClick={() => scrollBarBy(-1)}
                     aria-label={t('BoardView.scrollLeft')}
                     title={t('BoardView.scrollLeft')}
                     className={cn(BAR_ARROW_CLASS, 'left-0.5')}
                     initial={{ opacity: 0, x: -12 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -12 }}
                     transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                     <ChevronLeft className="h-4 w-4" />
                  </motion.button>
               )}
            </AnimatePresence>

            {/* The only scrollable element: capped to the card width (min-w-0) and scrolls; the wheel
                handler maps a vertical wheel to horizontal scroll, so the hidden scrollbar shows nothing. */}
            <div ref={barScrollRef} className="min-w-0 overflow-x-auto overscroll-x-contain scrollbar-hide">
               <div ref={barContentRef} className="flex w-max items-center gap-1 p-1">
                  <BoardNameField name={name} placeholder={t('BoardView.boardNamePlaceholder')} onCommit={(value) => void actions.renameBoard(value)} />
                  <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />
                  {/* Immediate one-click creates; a picker-first kind (a portal) is added via the radial in 1a. */}
                  {CREATABLE_REGISTRY.filter(({ requiresPicker }) => !requiresPicker).map(({ kind, icon: Icon, labelKey }) => (
                     <ToolbarButton key={kind} title={t(`BoardView.${labelKey}`)} onClick={() => handleAddItem(kind)}>
                        <Icon className="h-4 w-4" />
                     </ToolbarButton>
                  ))}
                  <BoardAddGameElementMenu
                     onAddTracker={(trackerType) => createTrackerAt(trackerType, currentViewCenter())}
                     onPickCardGame={handlePickCardGame}
                     onAddChallenge={() => createChallengeAt(currentViewCenter())}
                  />
                  <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />
                  <ToolbarButton title={t(`BoardView.grid${gridTypeKey(grid.type)}`)} onClick={handleCycleGrid}>
                     {gridIcon(grid.type)}
                  </ToolbarButton>
                  <ToolbarButton title={t('BoardView.fitToContent')} onClick={handleFitToContent}>
                     <Maximize className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton title={t('BoardView.returnToOrigin')} onClick={() => actions.setViewport(originViewport())}>
                     <Crosshair className="h-4 w-4" />
                  </ToolbarButton>
                  <span className="shrink-0 px-1.5 text-xs tabular-nums text-muted-foreground">{Math.round(viewport.zoom * 100)}%</span>
               </div>
            </div>

            <AnimatePresence>
               {barCanScrollRight && (
                  <motion.button
                     key="bar-scroll-right"
                     type="button"
                     onClick={() => scrollBarBy(1)}
                     aria-label={t('BoardView.scrollRight')}
                     title={t('BoardView.scrollRight')}
                     className={cn(BAR_ARROW_CLASS, 'right-0.5')}
                     initial={{ opacity: 0, x: 12 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: 12 }}
                     transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                     <ChevronRight className="h-4 w-4" />
                  </motion.button>
               )}
            </AnimatePresence>
         </div>

         {/* View-center coordinate readout: where the clip is centered in world space, to orient on a
             large board. Screen-space, bottom-right, inert (never eats a pan/click), tabular so the
             digits don't jump on negative or large values. Kept out of the scrolling top bar. */}
         <div className="pointer-events-none absolute bottom-2 right-2 select-none rounded bg-card/85 px-2 py-1 font-mono text-sm font-medium tabular-nums text-foreground/80 shadow-sm backdrop-blur-sm">
            x {Math.round(viewCenter.x)}, y {Math.round(viewCenter.y)}
         </div>

         {/* Right-click radial menu (portals to the body; screen-space, edge-clamped). */}
         {radial && <BoardRadialMenu screen={radial.screen} root={radialRoot} onClose={() => setRadial(null)} />}
      </div>

      {/* Card creation: a draggable, non-modal window. It lives OUTSIDE the clip div, so a pointer-down
          on it never reaches the canvas pan handler (the click-through fix); the canvas stays visible and
          interactive behind it. Close via the X button or Escape; confirm drops the card at the pending
          world point. */}
      {pendingCard && (
         <BoardCardCreationWindow
            game={pendingCard.game}
            initialScreen={pendingCard.screen}
            clipRect={clipRect}
            onConfirm={(options) => { createCardAt(pendingCard.game, options, pendingCard.world); setPendingCard(null); }}
            onClose={() => setPendingCard(null)}
         />
      )}

      {/* Portal target picker: the shared headless target list in a draggable, non-modal window (same shell as
          the card-creation dialog). It has no note, so it passes no `sections`; picking a row drops the portal
          styled and closes. Closes on the X button or Escape only - no outside-click dismiss, matching the card
          dialog; the search input autofocuses on open (from `LinkTargetList`). */}
      {portalPicker && (
         <BoardFloatingWindow
            initialScreen={portalPicker.screen}
            clipRect={clipRect}
            width={PORTAL_WINDOW_WIDTH}
            title={t('BoardView.portalPickerTitle')}
            onClose={() => setPortalPicker(null)}
         >
            <LinkTargetList onPick={handlePortalPick} />
         </BoardFloatingWindow>
      )}

      {/* Portal restyle editor: a movable window (same shell as the picker) driving the selected portal's
          style. Change-target reopens the picker in retarget mode; every style edit is one undoable command,
          read live-then-patched (via `commitPortalStyle`). Closes if its item is deleted or is no longer a
          portal. */}
      {portalEditor && items[portalEditor.itemId]?.content.kind === 'portal' && (
         <BoardFloatingWindow
            initialScreen={portalEditor.screen}
            clipRect={clipRect}
            width={PORTAL_EDITOR_WIDTH}
            title={t('BoardView.portalEditorTitle')}
            onClose={() => setPortalEditor(null)}
         >
            <BoardPortalEditor
               content={items[portalEditor.itemId].content as PortalBoardContent}
               onCommitStyle={(updater) => commitPortalStyle(portalEditor.itemId, updater)}
               onChangeTarget={() => setPortalPicker({ world: { x: 0, y: 0 }, screen: portalEditor.screen, retargetItemId: portalEditor.itemId })}
            />
         </BoardFloatingWindow>
      )}
      </>
   );
}

/** Panel width for the card-creation window; mirrors the `w-96` footprint so the drag clamp knows it. */
const CARD_WINDOW_WIDTH = 384;
/** Panel width for the portal-picker window; mirrors the picker's `w-[28rem]` footprint. */
const PORTAL_WINDOW_WIDTH = 448;
/** Panel width for the portal restyle editor window. */
const PORTAL_EDITOR_WIDTH = 340;
/** Screen-px margin a floating window keeps from the board edges (drag clamp + max-height). */
const BOARD_WINDOW_MARGIN = 16;

/**
 * A draggable, non-modal window floating over the board canvas. It lives OUTSIDE the clip div (fixed,
 * clip-relative coords) and owns a `{x,y}` position seeded from `initialScreen`; the header is the drag
 * handle. The whole panel stops pointer-down propagation so dragging or using it never pans the canvas,
 * and the position is clamped to the board rect (parameterized by `width`) so it can't be dragged off-screen.
 * A tall body scrolls inside (max-height capped to the space below the panel). No backdrop and no
 * outside-click dismiss - it closes on the X button or Escape only. Chrome is app-token only; the body is
 * unpadded, so each consumer owns its own padding.
 */
function BoardFloatingWindow({
   initialScreen,
   clipRect,
   width,
   title,
   onClose,
   children,
}: {
   initialScreen: { x: number; y: number };
   clipRect: { left: number; top: number; width: number; height: number };
   width: number;
   title: string;
   onClose: () => void;
   children: ReactNode;
}) {
   const { t } = useTranslation();
   const panelRef = useRef<HTMLDivElement | null>(null);

   /** Clamps a desired top-left so the panel stays fully within the board rect (its live height read from the DOM). */
   const clamp = useCallback(
      (x: number, y: number) => {
         const height = panelRef.current?.offsetHeight ?? 0;
         const minX = clipRect.left + BOARD_WINDOW_MARGIN;
         const minY = clipRect.top + BOARD_WINDOW_MARGIN;
         const maxX = Math.max(minX, clipRect.left + clipRect.width - width - BOARD_WINDOW_MARGIN);
         const maxY = Math.max(minY, clipRect.top + clipRect.height - height - BOARD_WINDOW_MARGIN);
         return { x: Math.min(Math.max(x, minX), maxX), y: Math.min(Math.max(y, minY), maxY) };
      },
      [clipRect, width],
   );

   // Seed the position from the initial anchor, clamped horizontally + off the top edge. Height is
   // unknown on the first render, so the vertical clamp settles once the panel measures (below).
   const [position, setPosition] = useState(() => {
      const minX = clipRect.left + BOARD_WINDOW_MARGIN;
      const maxX = Math.max(minX, clipRect.left + clipRect.width - width - BOARD_WINDOW_MARGIN);
      return { x: Math.min(Math.max(initialScreen.x, minX), maxX), y: Math.max(initialScreen.y, clipRect.top + BOARD_WINDOW_MARGIN) };
   });

   // Escape closes the window (it's non-modal, so no outside-click dismiss to lean on).
   useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
   }, [onClose]);

   /** Header drag: pointer on the header background repositions the whole panel (clamped). The X button
    *  and any header controls opt out via `closest('button')`, so pressing them never starts a drag. */
   const handleHeaderPointerDown = (event: ReactPointerEvent) => {
      if (event.button !== 0) return;
      if (event.target instanceof Element && event.target.closest('button')) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const origin = position;
      const onMove = (moveEvent: PointerEvent) => {
         setPosition(clamp(origin.x + (moveEvent.clientX - startX), origin.y + (moveEvent.clientY - startY)));
      };
      const onUp = () => {
         window.removeEventListener('pointermove', onMove);
         window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
   };

   // Grow downward from the panel's top; a tall body scrolls inside rather than spilling past the board.
   const maxHeight = clipRect.height > 0 ? clipRect.top + clipRect.height - position.y - BOARD_WINDOW_MARGIN : undefined;

   return (
      <div
         ref={panelRef}
         onPointerDown={(event) => event.stopPropagation()}
         style={{ left: position.x, top: position.y, width, maxHeight }}
         className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-popover/95 shadow-lg backdrop-blur-sm"
      >
         {/* Header doubles as the drag handle. Styled from app tokens only, so it follows the chosen theme palette. */}
         <div
            onPointerDown={handleHeaderPointerDown}
            className="flex shrink-0 cursor-move select-none items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5"
         >
            <span className="text-sm font-semibold text-foreground">{title}</span>
            <button
               type="button"
               title={t('Common.close')}
               aria-label={t('Common.close')}
               onClick={onClose}
               className="flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
               <X className="h-4 w-4" />
            </button>
         </div>
         {/* Body scrolls inside the panel (height capped to the space below it); padding is the consumer's. */}
         <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
   );
}

/**
 * The board's card-creation panel: a `BoardFloatingWindow` wrapping the card-creation form. The card it
 * makes keeps its game look; this creation chrome is app-token (via the shared window shell).
 */
function BoardCardCreationWindow({
   game,
   initialScreen,
   clipRect,
   onConfirm,
   onClose,
}: {
   game: GameSystem;
   initialScreen: { x: number; y: number };
   clipRect: { left: number; top: number; width: number; height: number };
   onConfirm: (options: CreateCardOptions) => void;
   onClose: () => void;
}) {
   const { t } = useTranslation();
   return (
      <BoardFloatingWindow
         initialScreen={initialScreen}
         clipRect={clipRect}
         width={CARD_WINDOW_WIDTH}
         title={t('CreateCardDialog.title')}
         onClose={onClose}
      >
         <div className="px-4 pb-3">
            <CardCreationForm game={game} mode="create" allowCharacterCard onConfirm={onConfirm} />
         </div>
      </BoardFloatingWindow>
   );
}

/** Maps a grid type to its i18n key suffix (`gridDots` / `gridLines` / `gridNone`). */
function gridTypeKey(type: BoardGridType): string {
   return type === 'dots' ? 'Dots' : type === 'lines' ? 'Lines' : 'None';
}

/**
 * The board name, living as the leading element of the top-left bar: click to edit, commit on
 * blur/Enter, revert on Escape. Controlled, with the buffer resyncing when `name` changes externally
 * (undo elsewhere, a fresh hydrate) via adjust-state-during-render. It auto-sizes to its content - a
 * hidden mirror span (same font/padding) measures the text (or placeholder when empty) and drives the
 * input width - so the title always shows fully and the bar grows to fit it; no truncation.
 */
function BoardNameField({ name, placeholder, onCommit }: { name: string; placeholder: string; onCommit: (value: string) => void }) {
   const [text, setText] = useState(name);
   const [synced, setSynced] = useState(name);
   if (name !== synced) {
      setSynced(name);
      setText(name);
   }

   const commit = () => {
      const trimmed = text.trim();
      if (trimmed && trimmed !== name) onCommit(trimmed);
      else setText(name); // empty or unchanged -> revert to the stored name
   };

   // A tab switch unmounts the board without a blur; flush the buffered name so it isn't lost.
   useCommitOnUnmount(commit);

   return (
      <div className="relative shrink-0">
         {/* Invisible mirror: its width (text or the placeholder when empty) sizes the field. */}
         <span aria-hidden className="invisible block whitespace-pre px-2 text-sm font-semibold">{text || placeholder}</span>
         <input
            type="text"
            value={text}
            placeholder={placeholder}
            onChange={(event) => setText(event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            onBlur={commit}
            onKeyDown={(event) => {
               if (event.key === 'Enter') event.currentTarget.blur();
               else if (event.key === 'Escape') {
                  setText(name);
                  event.currentTarget.blur();
               }
            }}
            className="pointer-events-auto absolute inset-0 h-full w-full rounded bg-transparent px-2 text-sm font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/60 hover:bg-muted/60 focus:bg-muted/50"
         />
      </div>
   );
}

/** A button in the canvas palette/view toolbar. */
function ToolbarButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
   return (
      <button
         type="button"
         onClick={onClick}
         title={title}
         aria-label={title}
         className="flex shrink-0 items-center justify-center rounded p-1.5 text-foreground hover:bg-muted cursor-pointer"
      >
         {children}
      </button>
   );
}
