// -- React Imports --
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';
import { useDroppable } from '@dnd-kit/core';
import cuid from 'cuid';

// -- Icon Imports --
import { Crosshair, Grid3x3, Grip, Image as ImageIcon, Maximize, NotebookText, Square, StickyNote } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { fitViewport, gridSpacing, screenToWorld, zoomToCursor } from '@/lib/board/boardCoordinates';
import { DEFAULT_CONNECTION_STYLE, connectionsReferencing } from '@/lib/board/boardConnections';

// -- Component Imports --
import { BoardItemBox } from './BoardItemBox';
import { BoardConnectionsLayer } from './BoardConnectionsLayer';

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
type CreatableKind = 'post-it' | 'journal' | 'image';

/** Default size (world units) per creatable kind. */
const ITEM_SIZE: Record<CreatableKind, { width: number; height: number }> = {
   'post-it': { width: 180, height: 180 },
   journal: { width: 260, height: 320 },
   image: { width: 240, height: 180 },
};

/** A fresh, empty content payload for a new item of `kind`. */
function emptyContent(kind: CreatableKind): BoardItemContent {
   switch (kind) {
      case 'post-it':
         return { kind: 'post-it', text: '' };
      case 'journal':
         return { kind: 'journal', pages: [''] };
      case 'image':
         return { kind: 'image', assetId: null, fit: 'cover' };
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

   // Selection is ephemeral: local only, never persisted or routed through commands.
   const [selectedId, setSelectedId] = useState<string | null>(null);
   const [isPanning, setIsPanning] = useState(false);

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
   const frontmostId = spatialItems.length > 0 ? spatialItems[spatialItems.length - 1].id : null;

   /** Converts an absolute cursor point to world coords via the live clip rect + viewport. */
   const cursorToWorld = useCallback((clientX: number, clientY: number): Point | null => {
      const el = clipRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return screenToWorld(clientX, clientY, { left: rect.left, top: rect.top }, viewportRef.current);
   }, []);

   /** Deletes an item and (cascade) every connection referencing it, so no orphan line remains. */
   const handleDelete = useCallback(
      (id: string) => {
         const liveItems = store.getState().items;
         // Separate undo steps in v1 (the connection deletes, then the item delete).
         for (const connectionId of connectionsReferencing(liveItems, id)) void actions.deleteItem(connectionId);
         void actions.deleteItem(id);
         setSelectedId((current) => (current === id ? null : current));
      },
      [store, actions],
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
   //  Delete the selected item via the keyboard
   // ==================
   useEffect(() => {
      if (selectedId === null) return;
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key !== 'Delete' && event.key !== 'Backspace') return;
         const target = event.target;
         if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
         event.preventDefault();
         handleDelete(selectedId);
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
   }, [selectedId, handleDelete]);

   // ==================
   //  Pan (background drag) + background click clears selection
   // ==================
   const handleBackgroundPointerDown = (event: ReactPointerEvent) => {
      setSelectedId(null);
      const vp = viewportRef.current;
      panStart.current = { x: event.clientX, y: event.clientY, origX: vp.x, origY: vp.y, zoom: vp.zoom };
      setIsPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleBackgroundPointerMove = (event: ReactPointerEvent) => {
      const start = panStart.current;
      if (!start) return;
      // Pan is in raw screen px (the world translate is applied before the scale).
      actions.setViewport({ x: start.origX + (event.clientX - start.x), y: start.origY + (event.clientY - start.y), zoom: start.zoom });
   };

   const handleBackgroundPointerUp = (event: ReactPointerEvent) => {
      panStart.current = null;
      setIsPanning(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
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
      void actions.addItem({
         id,
         kind,
         x: center.x - size.width / 2,
         y: center.y - size.height / 2,
         width: size.width,
         height: size.height,
         z,
         content: emptyContent(kind),
      });
      setSelectedId(id);
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

         {/* World layer: a single transform maps world coords to screen. */}
         <div className="absolute left-0 top-0" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }}>
            {spatialItems.map((item) => (
               <BoardItemBox
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedId}
                  isFrontmost={item.id === frontmostId}
                  zoom={viewport.zoom}
                  onSelect={setSelectedId}
                  onMove={actions.moveItem}
                  onResize={actions.resizeItem}
                  onUpdateContent={actions.updateItemContent}
                  onCacheLastKnown={actions.cacheReferenceLastKnown}
                  onBringToFront={actions.bringToFront}
                  onSendToBack={actions.sendToBack}
                  onDelete={handleDelete}
                  onConnectStart={handleConnectStart}
               />
            ))}

            {/* Connections (+ the connect-drag preview) render ABOVE the item boxes. */}
            <BoardConnectionsLayer
               items={items}
               connections={connectionItems}
               selectedId={selectedId}
               zoom={viewport.zoom}
               connectPreview={connectPreview}
               onSelect={setSelectedId}
               onUpdateStyle={(id, style) => void actions.updateItemContent(id, buildConnectionContent(items[id], style))}
               onDelete={handleDelete}
            />
         </div>

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
         className="pointer-events-auto w-64 max-w-[60vw] truncate rounded-md border border-transparent bg-card/80 px-3 py-1 text-center text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm hover:border-border focus:border-border focus:bg-card focus:outline-none"
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
