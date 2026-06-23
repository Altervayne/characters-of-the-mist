// -- React Imports --
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { screenDeltaToWorld } from '@/lib/board/boardCoordinates';

// -- Component Imports --
import { BoardItemBody } from './items/BoardItemBody';
import { BoardItemToolbar } from './BoardItemToolbar';

// -- Type Imports --
import type { BoardItem, BoardItemContent, BoardItemKind } from '@/lib/types/board';
import type { ResizePatch } from '@/lib/board/boardCommands';

/*
 * The chrome for one board item: the positioned box, the selection ring, a single
 * bottom-right resize grip, and the floating action toolbar. The body is delegated to
 * {@link BoardItemBody} and is purely content - move is the toolbar's grip, NOT a body
 * drag, so clicking into a post-it/journal edits text without a move stealing the pointer.
 *
 * Move and resize use plain pointer math (NOT dnd-kit, which is reserved for the
 * cross-surface drawer->board drop). The gesture is tracked in LOCAL state and rendered
 * live; exactly one command is dispatched on pointer-up, so one drag = one undo step.
 * Screen deltas divide by zoom so the box tracks the cursor at any zoom.
 */

/** Smallest a box may be resized to, in world units. */
const MIN_ITEM_SIZE = 40;
/** Resize-grip hit size in screen px (counter-scaled by zoom so it stays constant on screen). */
const HANDLE_SCREEN_SIZE = 14;

/** Kinds whose height follows their content (no internal scroll): the box auto-fits + width-only resizes. */
const AUTO_HEIGHT_KINDS = new Set<BoardItemKind>(['dice-tray']);
const isAutoHeight = (kind: BoardItemKind): boolean => AUTO_HEIGHT_KINDS.has(kind);

interface BoardItemBoxProps {
   item: BoardItem;
   /** In the selection set (draws the ring). */
   isSelected: boolean;
   /** The ONLY selected item: shows the per-item toolbar + resize grip (suppressed in a multi-selection). */
   soleSelected: boolean;
   /** Whether this item is already the frontmost; a plain click on it then needs no raise. */
   isFrontmost: boolean;
   /** Current zoom, so screen deltas convert to world deltas and chrome stays screen-constant. */
   zoom: number;
   /** Live world offset during an active group move (null when idle); renders the box at the offset. */
   moveDelta: { x: number; y: number } | null;
   /** Whether this item is part of the active group move (drives the grip cursor). */
   isMoving: boolean;
   /** Selects this item; `additive` (Shift/Ctrl) toggles it in/out of the set instead of replacing. */
   onSelect: (id: string, additive: boolean) => void;
   /** Pointer-down on the move grip; the canvas owns the (group-aware) move gesture. */
   onMoveStart: (id: string, event: ReactPointerEvent) => void;
   onResize: (id: string, patch: ResizePatch) => void;
   /** Non-undoable size write for the auto-height follow (measured content height). */
   onSyncSize: (id: string, size: { width?: number; height?: number }) => void;
   onUpdateContent: (id: string, content: BoardItemContent) => void;
   /** Direct (non-undoable) cache write for a reference item's last-known snapshot. */
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   onBringToFront: (id: string) => void;
   onSendToBack: (id: string) => void;
   onDelete: (id: string) => void;
   /** Starts a connect drag from this item's connect handle (not a move). */
   onConnectStart: (id: string, event: ReactPointerEvent) => void;
}

/** A live drag rect during a move/resize gesture (world coords); `null` when idle. */
interface DragRect {
   x: number;
   y: number;
   width: number;
   height: number;
}

export function BoardItemBox({
   item,
   isSelected,
   soleSelected,
   isFrontmost,
   zoom,
   moveDelta,
   isMoving,
   onSelect,
   onMoveStart,
   onResize,
   onSyncSize,
   onUpdateContent,
   onCacheLastKnown,
   onBringToFront,
   onSendToBack,
   onDelete,
   onConnectStart,
}: BoardItemBoxProps) {
   // Live resize rect (full rect during a resize); the commit reads from the ref so it
   // never depends on a stale closure. The group move offset is owned by the canvas and
   // arrives as `moveDelta`.
   const [resizeRect, setResizeRect] = useState<DragRect | null>(null);
   const resizeStart = useRef<{ x: number; y: number; orig: DragRect; rect: DragRect } | null>(null);

   // The toolbar's per-kind slot, state-backed so the body re-renders to portal into it
   // once it mounts (and portals nothing while the item is unselected and the bar is gone).
   const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);

   const autoHeight = isAutoHeight(item.kind);
   // For an auto-height item the body's own layout height drives the stored height; measure it
   // and sync (non-undoable). offsetHeight is layout px, unaffected by the world-layer scale,
   // so it equals the world height.
   const bodyRef = useRef<HTMLDivElement | null>(null);
   useEffect(() => {
      if (!autoHeight) return;
      const el = bodyRef.current;
      if (!el) return;
      const sync = () => {
         const measured = Math.round(el.offsetHeight);
         // Only write on a real change; with the container at height:auto, writing item.height
         // never reflows the body, so there is no observer feedback loop.
         if (measured > 0 && measured !== item.height) onSyncSize(item.id, { height: measured });
      };
      sync();
      const observer = new ResizeObserver(sync);
      observer.observe(el);
      return () => observer.disconnect();
   }, [autoHeight, item.id, item.height, onSyncSize]);

   // The rect to render: a live resize wins, else the base rect plus any active group-move offset.
   const rect: DragRect = resizeRect ?? {
      x: item.x + (moveDelta?.x ?? 0),
      y: item.y + (moveDelta?.y ?? 0),
      width: item.width,
      height: item.height,
   };

   // ==================
   //  Select + raise (body click)
   // ==================

   const handleBodyPointerDown = (event: ReactPointerEvent) => {
      event.stopPropagation(); // don't start a background pan
      const additive = event.shiftKey || event.ctrlKey || event.metaKey;
      onSelect(item.id, additive);
      // A plain click raises the item (kept from the old body-drag chrome); an additive
      // toggle must not reorder. In-body text fields stop propagation, so editing never raises.
      if (!additive && !isFrontmost) onBringToFront(item.id);
   };

   // ==================
   //  Resize (single bottom-right grip)
   // ==================

   const handleResizePointerDown = (event: ReactPointerEvent) => {
      event.stopPropagation();
      onSelect(item.id, false);
      const orig = { x: item.x, y: item.y, width: item.width, height: item.height };
      resizeStart.current = { x: event.clientX, y: event.clientY, orig, rect: orig };
      setResizeRect(orig);
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleResizePointerMove = (event: ReactPointerEvent) => {
      const start = resizeStart.current;
      if (!start) return;
      const delta = screenDeltaToWorld(event.clientX - start.x, event.clientY - start.y, zoom);
      // An auto-height item resizes width only; its height follows the content, so a vertical
      // drag must not fight the measured height.
      const next = autoHeight
         ? { ...start.orig, width: Math.max(MIN_ITEM_SIZE, start.orig.width + delta.x) }
         : computeResize(start.orig, delta);
      start.rect = next;
      setResizeRect(next);
   };

   const handleResizePointerUp = (event: ReactPointerEvent) => {
      const start = resizeStart.current;
      resizeStart.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      // Bottom-right only grows the size; x/y never move. Auto-height keeps its current height
      // (the measure-sync owns it); fixed items commit both.
      if (start) onResize(item.id, { width: start.rect.width, height: autoHeight ? item.height : start.rect.height });
      setResizeRect(null);
   };

   // ==================
   //  Render
   // ==================

   const gripSize = HANDLE_SCREEN_SIZE / zoom;
   // A pin is a round, fixed-size dot: borderless container, circular ring, no resize grip.
   const isPin = item.kind === 'pin';

   return (
      <div
         data-board-item-id={item.id}
         className="absolute"
         style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            // Auto-height items fit their content; the measured height syncs to the store so
            // chrome + connections still use a real value.
            height: autoHeight ? 'auto' : rect.height,
            transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
         }}
      >
         <div
            ref={bodyRef}
            onPointerDown={handleBodyPointerDown}
            className={cn(
               'w-full select-none overflow-hidden',
               autoHeight ? '' : 'h-full',
               // A pin is its own visual: a round, borderless dot with a circular ring. Every
               // other kind is a bordered card with a square ring.
               isPin
                  ? cn('rounded-full', isSelected ? 'ring-2 ring-primary' : 'cursor-pointer')
                  : cn('rounded-md border shadow-sm', isSelected ? 'border-primary ring-2 ring-primary' : 'border-border cursor-pointer hover:border-primary/50'),
            )}
         >
            <BoardItemBody
               item={item}
               isSelected={isSelected}
               toolbarSlot={toolbarSlot}
               onContentChange={(content) => onUpdateContent(item.id, content)}
               onCacheLastKnown={onCacheLastKnown}
               onDelete={onDelete}
               onRequestSelect={() => onSelect(item.id, false)}
            />
         </div>

         {/* Per-item chrome only for the sole selection; a multi-selection uses the group
             toolbar (rendered by the canvas) to avoid clutter, keeping only the rings. */}
         {soleSelected && (
            <>
               <BoardItemToolbar
                  zoom={zoom}
                  isMoving={isMoving}
                  onMoveStart={(event) => onMoveStart(item.id, event)}
                  onConnectStart={(event) => onConnectStart(item.id, event)}
                  onBringToFront={() => onBringToFront(item.id)}
                  onSendToBack={() => onSendToBack(item.id)}
                  onDelete={() => onDelete(item.id)}
                  slotRef={setToolbarSlot}
               />

               {/* Single bottom-right resize grip, counter-scaled to a constant on-screen size.
                   A pin is a fixed-size dot, so it has no grip. */}
               {!isPin && (
                  <div
                     onPointerDown={handleResizePointerDown}
                     onPointerMove={handleResizePointerMove}
                     onPointerUp={handleResizePointerUp}
                     className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 rounded-sm border border-background bg-primary"
                     style={{ width: gripSize, height: gripSize, cursor: 'nwse-resize' }}
                  />
               )}
            </>
         )}
      </div>
   );
}

/** Applies a bottom-right resize delta (width/height grow, x/y fixed), enforcing the min size. */
function computeResize(orig: DragRect, delta: { x: number; y: number }): DragRect {
   return {
      x: orig.x,
      y: orig.y,
      width: Math.max(MIN_ITEM_SIZE, orig.width + delta.x),
      height: Math.max(MIN_ITEM_SIZE, orig.height + delta.y),
   };
}
