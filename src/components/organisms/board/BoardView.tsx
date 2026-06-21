// -- React Imports --
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';
import cuid from 'cuid';

// -- Icon Imports --
import { Crosshair, Plus } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { screenToWorld, zoomToCursor } from '@/lib/board/boardCoordinates';

// -- Component Imports --
import { BoardItemBox } from './BoardItemBox';

// -- Store Imports --
import { useActiveBoardInstance } from '@/lib/board/ActiveBoardStoreContext';

// -- Type Imports --
import type { BoardStore } from '@/lib/stores/boardStore';
import type { Viewport } from '@/lib/types/board';

/*
 * The board canvas: a pan/zoom world layer over the active board, with freeform move /
 * resize / select / z-order / delete wired to the board store's commands. It reads the
 * ACTIVE BOARD instance (never the character context) and only mounts when a board tab
 * is active. Per-kind item rendering, a real creation palette, and connections are later
 * prompts; items here are generic boxes and the `+` adds a stand-in post-it.
 *
 * Note: there is no sidebar/keyboard undo affordance on a board tab yet (board-7). The
 * store's undo works and is test-covered; this just doesn't surface it.
 */

/** A new stand-in item's default size, in world units. */
const DEFAULT_ITEM_WIDTH = 160;
const DEFAULT_ITEM_HEIGHT = 120;
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

   const clipRef = useRef<HTMLDivElement | null>(null);
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
   const handleAddItem = () => {
      const el = clipRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Place the new item centered in the current view (screen center -> world).
      const center = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2, { left: rect.left, top: rect.top }, viewportRef.current);
      const zValues = sortedItems.map((item) => item.z);
      const z = zValues.length > 0 ? Math.max(...zValues) + 1 : 0;
      const id = cuid();
      // Stand-in item until board-8's real palette: a minimal empty post-it.
      void actions.addItem({
         id,
         kind: 'post-it',
         x: center.x - DEFAULT_ITEM_WIDTH / 2,
         y: center.y - DEFAULT_ITEM_HEIGHT / 2,
         width: DEFAULT_ITEM_WIDTH,
         height: DEFAULT_ITEM_HEIGHT,
         z,
         content: { kind: 'post-it', text: '' },
      });
      setSelectedId(id);
   };

   const handleDelete = (id: string) => {
      void actions.deleteItem(id);
      if (selectedId === id) setSelectedId(null);
   };

   return (
      <div
         ref={clipRef}
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
                  onBringToFront={actions.bringToFront}
                  onSendToBack={actions.sendToBack}
                  onDelete={handleDelete}
               />
            ))}
         </div>

         {/* Floating toolbar: stop the pointer from starting a pan when using it. */}
         <div
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute left-3 top-3 flex items-center gap-1 rounded-md border border-border bg-card/90 p-1 shadow-sm backdrop-blur-sm"
         >
            <button
               type="button"
               onClick={handleAddItem}
               title={t('BoardView.addItem')}
               aria-label={t('BoardView.addItem')}
               className="flex items-center justify-center rounded p-1.5 text-foreground hover:bg-muted cursor-pointer"
            >
               <Plus className="h-4 w-4" />
            </button>
            <button
               type="button"
               onClick={() => actions.setViewport({ ...ORIGIN_VIEWPORT })}
               title={t('BoardView.returnToOrigin')}
               aria-label={t('BoardView.returnToOrigin')}
               className="flex items-center justify-center rounded p-1.5 text-foreground hover:bg-muted cursor-pointer"
            >
               <Crosshair className="h-4 w-4" />
            </button>
            <span className="px-1.5 text-xs tabular-nums text-muted-foreground">{Math.round(viewport.zoom * 100)}%</span>
         </div>
      </div>
   );
}
