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
import { ChevronLeft, ChevronRight, Copy, Crosshair, Dices, FilePlus2, Frame, Grid3x3, Grip, Image as ImageIcon, LayoutGrid, ListChecks, MapPin, Maximize, NotebookText, Plus, Skull, Square, StickyNote, Trash2, X } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { fitViewport, gridSpacing, itemsInMarquee, screenDeltaToWorld, screenToWorld, zoomToCursor } from '@/lib/board/boardCoordinates';
import { DEFAULT_CONNECTION_STYLE } from '@/lib/board/boardConnections';
import { zoneContaining, zoneContentMinSize } from '@/lib/board/zoneMembership';
import { BACK_LAYER_Z_INDEX, connectionsZIndex, groupToolbarZIndex, itemZIndex } from '@/lib/board/boardLayering';
import { EMBEDDED_TRACKER_SIZES, EMBEDDED_CARD_SIZE } from '@/lib/board/embedDrawerItem';
import { emptyTracker, type TrackerType } from '@/lib/trackers/emptyTracker';
import { buildCard } from '@/lib/cards/buildCard';
import { GAME_VISUALS, GAME_CARD_OPTIONS } from '@/lib/constants/gameVisuals';
import { getItemTypeIconComponent } from '@/lib/utils/drawer-icons';
import { useCommitOnUnmount } from '@/hooks/useCommitOnUnmount';
import { runSaveImageToDrawerAs, runSaveItemToDrawer, runSaveItemToDrawerAs } from '@/hooks/board/useBoardItemSaveBack';

// -- Component Imports --
import { BoardItemBox } from './BoardItemBox';
import { BoardConnectionsLayer } from './BoardConnectionsLayer';
import { BoardGroupToolbar } from './BoardGroupToolbar';
import { BoardRadialMenu, type RadialNode } from './BoardRadialMenu';
import { CardCreationForm } from '@/components/organisms/cards/CardCreationForm';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

// -- Store Imports --
import { useActiveBoardInstance } from '@/lib/board/ActiveBoardStoreContext';
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useDrawerStore } from '@/lib/stores/drawerStore';

// -- React Imports --
import type { CSSProperties } from 'react';

// -- Type Imports --
import type { BoardStore } from '@/lib/stores/boardStore';
import type { BoardGrid, BoardGridType, BoardItem, BoardItemContent, ConnectionStyle, Viewport } from '@/lib/types/board';
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

/** The board-native item kinds the palette can create. */
type CreatableKind = 'post-it' | 'journal' | 'image' | 'pin' | 'dice-tray' | 'zone';

/** A fresh pin's color (classic corkboard red). */
const DEFAULT_PIN_COLOR = '#ef4444';

/** The create actions, in ring order: each kind's palette icon + label key (reused by the radial). */
const RADIAL_CREATE: { kind: CreatableKind; Icon: typeof StickyNote; labelKey: string }[] = [
   { kind: 'post-it', Icon: StickyNote, labelKey: 'addPostIt' },
   { kind: 'journal', Icon: NotebookText, labelKey: 'addJournal' },
   { kind: 'image', Icon: ImageIcon, labelKey: 'addImage' },
   { kind: 'pin', Icon: MapPin, labelKey: 'addPin' },
   { kind: 'dice-tray', Icon: Dices, labelKey: 'addDiceTray' },
   { kind: 'zone', Icon: Frame, labelKey: 'addZone' },
];

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

/** Default size (world units) per creatable kind. A pin is a small fixed dot. */
const ITEM_SIZE: Record<CreatableKind, { width: number; height: number }> = {
   'post-it': { width: 180, height: 180 },
   journal: { width: 260, height: 320 },
   image: { width: 240, height: 180 },
   pin: { width: 28, height: 28 },
   'dice-tray': { width: 220, height: 260 },
   zone: { width: 360, height: 280 },
};

/** A fresh, empty content payload for a new item of `kind`. */
function emptyContent(kind: CreatableKind): BoardItemContent {
   switch (kind) {
      case 'post-it':
         // Board-born copy: source-less (Save-As only), a fresh standalone note in `data`.
         return { kind: 'post-it', mode: 'copy', data: { id: cuid(), text: '' } };
      case 'journal':
         // Board-born copy: source-less (Save-As only), a fresh standalone journal in `data`.
         return { kind: 'journal', mode: 'copy', data: { id: cuid(), pages: [{ id: cuid(), text: '' }], bookmarks: [] } };
      case 'image':
         return { kind: 'image', assetId: null, fit: 'cover' };
      case 'pin':
         return { kind: 'pin', color: DEFAULT_PIN_COLOR };
      case 'dice-tray':
         return { kind: 'dice-tray', title: '', dice: [{ id: cuid(), sides: 6 }, { id: cuid(), sides: 6 }], modifiers: [] };
      case 'zone':
         return { kind: 'zone', collapsed: false };
   }
}

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

   // A pending board card creation: the chosen game, the world point to drop at, and the cursor screen
   // point the creation popover anchors to. Null when closed.
   const [pendingCard, setPendingCard] = useState<{ game: GameSystem; world: Point; screen: { x: number; y: number } } | null>(null);

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
   /** Creates a new item of `kind` centered on `worldCenter`, joining a zone it lands in, then selects it. */
   const createItemAt = (kind: CreatableKind, worldCenter: Point) => {
      const zValues = sortedItems.map((item) => item.z);
      const z = zValues.length > 0 ? Math.max(...zValues) + 1 : 0;
      const size = ITEM_SIZE[kind];
      const id = cuid();
      const placement = { id, x: worldCenter.x - size.width / 2, y: worldCenter.y - size.height / 2, width: size.width, height: size.height };
      // A non-zone item created over a zone joins it (same center-in-rectangle rule as a drop).
      const zoneId = kind === 'zone' ? undefined : zoneContaining(placement, zoneItems) ?? undefined;
      void actions.addItem({ ...placement, kind, z, zoneId, content: emptyContent(kind) });
      setSelectedIds(new Set([id]));
   };

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
      clearBoardAction();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- the handlers close over live selection/viewCenter that change every render; only the action id should re-trigger this.
   }, [pendingBoardAction, clearBoardAction]);

   /** Palette add: drop the new item centered in the current view (the radial uses the cursor point). */
   const handleAddItem = (kind: CreatableKind) => {
      const el = clipRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const center = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2, { left: rect.left, top: rect.top }, viewportRef.current);
      createItemAt(kind, center);
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
            resizeMin={members ? zoneContentMinSize(item, members) : undefined}
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
              children: RADIAL_CREATE.map(({ kind, Icon, labelKey }) => ({
                 id: kind,
                 icon: <Icon className="h-5 w-5" />,
                 label: t(`BoardView.${labelKey}`),
                 onSelect: () => createItemAt(kind, radial.world),
              })),
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
                  <ToolbarButton title={t('BoardView.addPostIt')} onClick={() => handleAddItem('post-it')}>
                     <StickyNote className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton title={t('BoardView.addJournal')} onClick={() => handleAddItem('journal')}>
                     <NotebookText className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton title={t('BoardView.addImage')} onClick={() => handleAddItem('image')}>
                     <ImageIcon className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton title={t('BoardView.addPin')} onClick={() => handleAddItem('pin')}>
                     <MapPin className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton title={t('BoardView.addDiceTray')} onClick={() => handleAddItem('dice-tray')}>
                     <Dices className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton title={t('BoardView.addZone')} onClick={() => handleAddItem('zone')}>
                     <Frame className="h-4 w-4" />
                  </ToolbarButton>
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

      {/* Card creation: a popover "window" anchored at the cursor. It lives OUTSIDE the clip div, so a
          pointer-down on its controls does NOT bubble (in the React tree) to the canvas pan handler -
          the actual fix for the click-through. `modal` consumes the dismissing outside-click; Escape /
          the close button cancel; confirm drops the card at the pending world point. */}
      {pendingCard && (() => {
         // Clamp the anchor to the board's own rect so a panel grown downward (collision avoidance
         // off, see below) stays over the board. Read the clip's live box, not window dims, so it's
         // correct regardless of the host's viewport reporting.
         const MARGIN = 16;
         const PANEL_WIDTH = 384; // w-96
         // The clip's box from state (never the ref during render); falls back to the raw point.
         const hasBounds = clipRect.width > 0 && clipRect.height > 0;
         const left = clipRect.left;
         const right = hasBounds ? clipRect.left + clipRect.width : pendingCard.screen.x + PANEL_WIDTH;
         const top = clipRect.top;
         const bottom = hasBounds ? clipRect.top + clipRect.height : pendingCard.screen.y + 320;
         const anchorX = Math.min(Math.max(pendingCard.screen.x, left + MARGIN), Math.max(left + MARGIN, right - PANEL_WIDTH - MARGIN));
         const anchorY = Math.min(Math.max(pendingCard.screen.y, top + MARGIN), Math.max(top + MARGIN, bottom - 160));
         return (
            <Popover open modal onOpenChange={(open) => { if (!open) setPendingCard(null); }}>
               <PopoverAnchor asChild>
                  <div className="pointer-events-none fixed" style={{ left: anchorX, top: anchorY, width: 0, height: 0 }} />
               </PopoverAnchor>
               <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={8}
                  // Anchor once and grow DOWNWARD: collision avoidance would re-solve the position on
                  // every height change (picking a card type adds rows) and make the panel jump.
                  avoidCollisions={false}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="flex max-h-(--radix-popover-content-available-height) w-96 flex-col overflow-hidden rounded-lg border border-border bg-popover/95 p-0 shadow-lg backdrop-blur-sm"
               >
                  {/* Header styled from app tokens only, so it follows the chosen theme palette (the card
                      you make keeps its game look; this creation chrome does not). */}
                  <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
                     <span className="text-sm font-semibold text-foreground">{t('CreateCardDialog.title')}</span>
                     <button
                        type="button"
                        title={t('Common.close')}
                        aria-label={t('Common.close')}
                        onClick={() => setPendingCard(null)}
                        className="flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                     >
                        <X className="h-4 w-4" />
                     </button>
                  </div>
                  {/* A tall form scrolls inside the panel (height capped to the space below the anchor). */}
                  <div className="min-h-0 overflow-y-auto px-4 pb-3">
                     <CardCreationForm
                        game={pendingCard.game}
                        mode="create"
                        allowCharacterCard
                        onConfirm={(options) => { createCardAt(pendingCard.game, options, pendingCard.world); setPendingCard(null); }}
                     />
                  </div>
               </PopoverContent>
            </Popover>
         );
      })()}
      </>
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
