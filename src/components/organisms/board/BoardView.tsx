// -- React Imports --
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';
import { useDroppable } from '@dnd-kit/core';
import cuid from 'cuid';

// -- Icon Imports --
import { Crosshair, Dices, Frame, Grid3x3, Grip, Image as ImageIcon, LayoutGrid, MapPin, Maximize, NotebookText, Square, StickyNote } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { fitViewport, gridSpacing, itemsInMarquee, screenDeltaToWorld, screenToWorld, zoomToCursor } from '@/lib/board/boardCoordinates';
import { DEFAULT_CONNECTION_STYLE } from '@/lib/board/boardConnections';
import { zoneContaining, zoneContentMinSize } from '@/lib/board/zoneMembership';

// -- Component Imports --
import { BoardItemBox } from './BoardItemBox';
import { BoardConnectionsLayer } from './BoardConnectionsLayer';
import { BoardGroupToolbar } from './BoardGroupToolbar';

// -- Store Imports --
import { useActiveBoardInstance } from '@/lib/board/ActiveBoardStoreContext';

// -- React Imports --
import type { CSSProperties } from 'react';

// -- Type Imports --
import type { BoardStore } from '@/lib/stores/boardStore';
import type { BoardGrid, BoardGridType, BoardItem, BoardItemContent, Viewport } from '@/lib/types/board';
import type { Point } from '@/lib/board/boardConnections';

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
         return { kind: 'post-it', text: '' };
      case 'journal':
         return { kind: 'journal', pages: [{ id: cuid(), text: '' }], bookmarks: [] };
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

/** Rebuilds a connection's content with a new style, preserving its endpoints. */
function buildConnectionContent(item: BoardItem | undefined, style: { width: number; color: string }): BoardItemContent {
   const content = item?.content;
   const from = content?.kind === 'connection' ? content.from : '';
   const to = content?.kind === 'connection' ? content.to : '';
   return { kind: 'connection', from, to, style };
}

/** Wheel-to-zoom sensitivity: a typical notch (~100 deltaY) is a gentle step. */
const ZOOM_SENSITIVITY = 0.0015;
/** The store's default viewport, reused by return-to-origin. */
const ORIGIN_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

/** Screen-px margin fit-to-content leaves around the framed items. */
const FIT_PADDING = 64;
/** The grid styles the toolbar control cycles through, in order. */
const GRID_CYCLE: BoardGridType[] = ['dots', 'lines', 'none'];

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
   const handleAddItem = (kind: CreatableKind) => {
      const el = clipRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Place the new item centered in the current view (screen center -> world).
      const center = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2, { left: rect.left, top: rect.top }, viewportRef.current);
      const zValues = sortedItems.map((item) => item.z);
      const z = zValues.length > 0 ? Math.max(...zValues) + 1 : 0;
      const size = ITEM_SIZE[kind];
      const id = cuid();
      const placement = { id, x: center.x - size.width / 2, y: center.y - size.height / 2, width: size.width, height: size.height };
      // A non-zone item created over a zone joins it (same center-in-rectangle rule as a drop).
      const zoneId = kind === 'zone' ? undefined : zoneContaining(placement, zoneItems) ?? undefined;
      void actions.addItem({
         ...placement,
         kind,
         z,
         zoneId,
         content: emptyContent(kind),
      });
      setSelectedIds(new Set([id]));
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

   // A selected item renders full front-row: above other items AND above the connection layer, so
   // no string crosses its face while the user works on it. We split the non-zone items by
   // selection and render the selected ones in a pass AFTER the connections (the unselected pass
   // stays before them). Render-only - stored z is untouched - so deselect drops the item back
   // below the connections at its real layer. Both lists keep z order (filtering a z-sorted list).
   const nonZoneUnselected = nonZoneItems.filter((item) => !selectedIds.has(item.id));
   const nonZoneSelected = nonZoneItems.filter((item) => selectedIds.has(item.id));

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
            onBringToFront={actions.bringToFront}
            onSendToBack={actions.sendToBack}
            onDelete={handleDelete}
            onConnectStart={handleConnectStart}
            backLayer={backLayer}
         />
      );
   };

   return (
      <div
         ref={setClipRefs}
         data-board-clip
         onPointerDown={handleBackgroundPointerDown}
         onPointerMove={handleBackgroundPointerMove}
         onPointerUp={handleBackgroundPointerUp}
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
            {/* Behind-items layer: zones portal their tinted rectangles here (first child, so it
                paints behind every item box). Inert itself; the rectangles handle their own clicks. */}
            <div ref={setBackLayer} className="absolute left-0 top-0" />

            {/* Unselected non-zone items, then zones on top: a zone's box renders only its header +
                chrome (its background is in the back layer), so its chrome floats above the items.
                The SELECTED items render later, after the connection layer below. */}
            {nonZoneUnselected.map(renderBox)}
            {zoneItems.map(renderBox)}

            {/* Group toolbar over the multi-selection's bounding box (per-item bars suppressed). */}
            {groupBbox && (
               <div className="absolute" style={{ left: groupBbox.x, top: groupBbox.y, width: groupBbox.width, height: groupBbox.height }}>
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

            {/* Connections (+ the connect-drag preview) render ABOVE the item boxes. A connection
                is highlighted only when it is the sole selection (groups are about spatial items). */}
            <BoardConnectionsLayer
               items={items}
               connections={connectionItems}
               selectedId={soleSelectedId}
               zoom={viewport.zoom}
               moving={groupDrag}
               collapsedZoneIds={collapsedZoneIds}
               connectPreview={connectPreview}
               onSelect={(id) => handleSelect(id, false)}
               onUpdateStyle={(id, style) => void actions.updateItemContent(id, buildConnectionContent(items[id], style))}
               onDelete={handleDelete}
            />

            {/* Selected non-zone items render LAST - above the connection layer - so a string to a
                selected item runs behind its face (still anchored to its edge). Render-only; on
                deselect the item rejoins the unselected pass below the connections. */}
            {nonZoneSelected.map(renderBox)}
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

         {/* Floating palette + view controls: stop the pointer from starting a pan. */}
         <div
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute left-3 top-3 flex items-center gap-1 rounded-md border border-border bg-card/90 p-1 shadow-sm backdrop-blur-sm"
         >
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
            <div className="mx-0.5 h-5 w-px bg-border" />
            <ToolbarButton title={t(`BoardView.grid${gridTypeKey(grid.type)}`)} onClick={handleCycleGrid}>
               {gridIcon(grid.type)}
            </ToolbarButton>
            <ToolbarButton title={t('BoardView.fitToContent')} onClick={handleFitToContent}>
               <Maximize className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title={t('BoardView.returnToOrigin')} onClick={() => actions.setViewport({ ...ORIGIN_VIEWPORT })}>
               <Crosshair className="h-4 w-4" />
            </ToolbarButton>
            <span className="px-1.5 text-xs tabular-nums text-muted-foreground">{Math.round(viewport.zoom * 100)}%</span>
         </div>

         {/* Editable board name, top-center; stops the pointer so editing it never pans. */}
         <div onPointerDown={(event) => event.stopPropagation()} className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <BoardNameField name={name} placeholder={t('BoardView.boardNamePlaceholder')} onCommit={(value) => void actions.renameBoard(value)} />
         </div>
      </div>
   );
}

/** Maps a grid type to its i18n key suffix (`gridDots` / `gridLines` / `gridNone`). */
function gridTypeKey(type: BoardGridType): string {
   return type === 'dots' ? 'Dots' : type === 'lines' ? 'Lines' : 'None';
}

/**
 * The on-canvas board name: click to edit, commit on blur/Enter, revert on Escape. Mirrors
 * the character name field's controlled-input feel; the buffer resyncs when `name` changes
 * externally (undo elsewhere, a fresh hydrate) via adjust-state-during-render.
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

   return (
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
         className="pointer-events-auto w-96 max-w-[60vw] truncate rounded-md border border-transparent bg-card/80 px-3 py-1 text-center text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm hover:border-border focus:border-border focus:bg-card focus:outline-none"
      />
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
         className="flex items-center justify-center rounded p-1.5 text-foreground hover:bg-muted cursor-pointer"
      >
         {children}
      </button>
   );
}
