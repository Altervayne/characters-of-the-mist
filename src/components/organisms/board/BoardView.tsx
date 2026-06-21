// -- React Imports --
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';
import { useDroppable } from '@dnd-kit/core';
import cuid from 'cuid';

// -- Icon Imports --
import { Crosshair, Image as ImageIcon, NotebookText, StickyNote } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { screenToWorld, zoomToCursor } from '@/lib/board/boardCoordinates';

// -- Component Imports --
import { BoardItemBox } from './BoardItemBox';

// -- Store Imports --
import { useActiveBoardInstance } from '@/lib/board/ActiveBoardStoreContext';

// -- Type Imports --
import type { BoardStore } from '@/lib/stores/boardStore';
import type { BoardItemContent, Viewport } from '@/lib/types/board';

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

/** Wheel-to-zoom sensitivity: a typical notch (~100 deltaY) is a gentle step. */
const ZOOM_SENSITIVITY = 0.0015;
/** The store's default viewport, reused by return-to-origin. */
const ORIGIN_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

/** The canvas; renders nothing when no board tab is active. */
export function BoardView() {
   const instance = useActiveBoardInstance();
   if (!instance) return null;
   return <BoardCanvas store={instance} />;
}

function BoardCanvas({ store }: { store: BoardStore }) {
   const { t } = useTranslation();
   const viewport = useStore(store, (state) => state.viewport);
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

   const sortedItems = Object.values(items).sort((a, b) => a.z - b.z);
   const frontmostId = sortedItems.length > 0 ? sortedItems[sortedItems.length - 1].id : null;

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
         actions.deleteItem(selectedId);
         setSelectedId(null);
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
   }, [selectedId, actions]);

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

   const handleDelete = (id: string) => {
      void actions.deleteItem(id);
      if (selectedId === id) setSelectedId(null);
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
         {/* World layer: a single transform maps world coords to screen. */}
         <div className="absolute left-0 top-0" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }}>
            {sortedItems.map((item) => (
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
                  onBringToFront={actions.bringToFront}
                  onSendToBack={actions.sendToBack}
                  onDelete={handleDelete}
               />
            ))}
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
            <ToolbarButton title={t('BoardView.returnToOrigin')} onClick={() => actions.setViewport({ ...ORIGIN_VIEWPORT })}>
               <Crosshair className="h-4 w-4" />
            </ToolbarButton>
            <span className="px-1.5 text-xs tabular-nums text-muted-foreground">{Math.round(viewport.zoom * 100)}%</span>
         </div>
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
         className="flex items-center justify-center rounded p-1.5 text-foreground hover:bg-muted cursor-pointer"
      >
         {children}
      </button>
   );
}
