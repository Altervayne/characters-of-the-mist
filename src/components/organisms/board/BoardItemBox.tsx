// -- React Imports --
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { screenDeltaToWorld } from '@/lib/board/boardCoordinates';

// -- Component Imports --
import { BoardItemBody } from './items/BoardItemBody';
import { BoardItemToolbar } from './BoardItemToolbar';

// -- Type Imports --
import type { BoardItem, BoardItemContent } from '@/lib/types/board';
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

interface BoardItemBoxProps {
   item: BoardItem;
   isSelected: boolean;
   /** Whether this item is already the frontmost; a plain click on it then needs no raise. */
   isFrontmost: boolean;
   /** Current zoom, so screen deltas convert to world deltas and chrome stays screen-constant. */
   zoom: number;
   onSelect: (id: string) => void;
   onMove: (id: string, position: { x: number; y: number }) => void;
   onResize: (id: string, patch: ResizePatch) => void;
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
   isFrontmost,
   zoom,
   onSelect,
   onMove,
   onResize,
   onUpdateContent,
   onCacheLastKnown,
   onBringToFront,
   onSendToBack,
   onDelete,
   onConnectStart,
}: BoardItemBoxProps) {
   // Live gesture state for rendering; the commit reads from refs (below) so it never
   // depends on a stale handler closure. `moveOffset` is a world-space delta during a
   // move; `resizeRect` is the full live rect during a resize. Only one is active.
   const [moveOffset, setMoveOffset] = useState<{ x: number; y: number } | null>(null);
   const [resizeRect, setResizeRect] = useState<DragRect | null>(null);
   const moveStart = useRef<{ x: number; y: number; moved: boolean; offset: { x: number; y: number } } | null>(null);
   const resizeStart = useRef<{ x: number; y: number; orig: DragRect; rect: DragRect } | null>(null);

   // The toolbar's per-kind slot, state-backed so the body re-renders to portal into it
   // once it mounts (and portals nothing while the item is unselected and the bar is gone).
   const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);

   // The rect to render: a live resize wins, else the base rect plus any move offset.
   const rect: DragRect = resizeRect ?? {
      x: item.x + (moveOffset?.x ?? 0),
      y: item.y + (moveOffset?.y ?? 0),
      width: item.width,
      height: item.height,
   };

   // ==================
   //  Move (from the toolbar grip)
   // ==================

   const handleMovePointerDown = (event: ReactPointerEvent) => {
      event.stopPropagation(); // don't start a background pan
      onSelect(item.id);
      moveStart.current = { x: event.clientX, y: event.clientY, moved: false, offset: { x: 0, y: 0 } };
      setMoveOffset({ x: 0, y: 0 });
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleMovePointerMove = (event: ReactPointerEvent) => {
      const start = moveStart.current;
      if (!start) return;
      const delta = screenDeltaToWorld(event.clientX - start.x, event.clientY - start.y, zoom);
      if (delta.x !== 0 || delta.y !== 0) start.moved = true;
      start.offset = delta;
      setMoveOffset(delta);
   };

   const handleMovePointerUp = (event: ReactPointerEvent) => {
      const start = moveStart.current;
      moveStart.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      // One drag = one command, dispatched only on release (offset from the ref, never a
      // stale closure). A grip click without movement is a no-op.
      if (start?.moved) onMove(item.id, { x: item.x + start.offset.x, y: item.y + start.offset.y });
      setMoveOffset(null);
   };

   // ==================
   //  Select + raise (body click)
   // ==================

   const handleBodyPointerDown = (event: ReactPointerEvent) => {
      event.stopPropagation(); // don't start a background pan
      onSelect(item.id);
      // Click-raises-to-front, kept from the old body-drag chrome. In-body text fields stop
      // propagation, so editing never raises (and never reaches here).
      if (!isFrontmost) onBringToFront(item.id);
   };

   // ==================
   //  Resize (single bottom-right grip)
   // ==================

   const handleResizePointerDown = (event: ReactPointerEvent) => {
      event.stopPropagation();
      onSelect(item.id);
      const orig = { x: item.x, y: item.y, width: item.width, height: item.height };
      resizeStart.current = { x: event.clientX, y: event.clientY, orig, rect: orig };
      setResizeRect(orig);
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleResizePointerMove = (event: ReactPointerEvent) => {
      const start = resizeStart.current;
      if (!start) return;
      const delta = screenDeltaToWorld(event.clientX - start.x, event.clientY - start.y, zoom);
      const next = computeResize(start.orig, delta);
      start.rect = next;
      setResizeRect(next);
   };

   const handleResizePointerUp = (event: ReactPointerEvent) => {
      const start = resizeStart.current;
      resizeStart.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      // Bottom-right only grows width/height; x/y never move, so the patch carries neither.
      if (start) onResize(item.id, { width: start.rect.width, height: start.rect.height });
      setResizeRect(null);
   };

   // ==================
   //  Render
   // ==================

   const gripSize = HANDLE_SCREEN_SIZE / zoom;

   return (
      <div
         data-board-item-id={item.id}
         className="absolute"
         style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
         }}
      >
         <div
            onPointerDown={handleBodyPointerDown}
            className={cn(
               'h-full w-full select-none overflow-hidden rounded-md border shadow-sm',
               isSelected ? 'border-primary ring-2 ring-primary' : 'border-border cursor-pointer hover:border-primary/50',
            )}
         >
            <BoardItemBody
               item={item}
               isSelected={isSelected}
               toolbarSlot={toolbarSlot}
               onContentChange={(content) => onUpdateContent(item.id, content)}
               onCacheLastKnown={onCacheLastKnown}
               onDelete={onDelete}
               onRequestSelect={() => onSelect(item.id)}
            />
         </div>

         {isSelected && (
            <>
               <BoardItemToolbar
                  zoom={zoom}
                  isMoving={moveOffset !== null}
                  moveHandle={{ onPointerDown: handleMovePointerDown, onPointerMove: handleMovePointerMove, onPointerUp: handleMovePointerUp }}
                  onConnectStart={(event) => onConnectStart(item.id, event)}
                  onBringToFront={() => onBringToFront(item.id)}
                  onSendToBack={() => onSendToBack(item.id)}
                  onDelete={() => onDelete(item.id)}
                  slotRef={setToolbarSlot}
               />

               {/* Single bottom-right resize grip, counter-scaled to a constant on-screen size. */}
               <div
                  onPointerDown={handleResizePointerDown}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 rounded-sm border border-background bg-primary"
                  style={{ width: gripSize, height: gripSize, cursor: 'nwse-resize' }}
               />
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
