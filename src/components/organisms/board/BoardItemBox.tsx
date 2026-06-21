// -- React Imports --
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { ArrowDownToLine, ArrowUpToLine, Trash2 } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { screenDeltaToWorld } from '@/lib/board/boardCoordinates';

// -- Component Imports --
import { BoardItemBody } from './items/BoardItemBody';

// -- Type Imports --
import type { BoardItem, BoardItemContent } from '@/lib/types/board';
import type { ResizePatch } from '@/lib/board/boardCommands';

/*
 * The chrome for one board item: the positioned box, move/resize gestures, the
 * selection ring, resize handles, and the raise/lower/delete toolbar. The body itself
 * is delegated to {@link BoardItemBody}, which renders the real per-kind content.
 *
 * Move and resize use plain pointer math (NOT dnd-kit, which is reserved for the
 * cross-surface drawer->board drop). The gesture is tracked in LOCAL state and rendered
 * live; exactly one command is dispatched on pointer-up, so one drag = one undo step.
 * Screen deltas divide by zoom so the box tracks the cursor at any zoom.
 */

/** Smallest a box may be resized to, in world units. */
const MIN_ITEM_SIZE = 40;
/** Resize-handle hit size in screen px (counter-scaled by zoom so it stays constant on screen). */
const HANDLE_SCREEN_SIZE = 10;

/** A resize direction: which edges a handle drives (-1 = left/top, 1 = right/bottom, 0 = none). */
interface HandleDir {
   h: -1 | 0 | 1;
   v: -1 | 0 | 1;
}

const RESIZE_HANDLES: { dir: HandleDir; position: string; cursor: string }[] = [
   { dir: { h: -1, v: -1 }, position: 'left-0 top-0', cursor: 'nwse-resize' },
   { dir: { h: 0, v: -1 }, position: 'left-1/2 top-0', cursor: 'ns-resize' },
   { dir: { h: 1, v: -1 }, position: 'right-0 top-0', cursor: 'nesw-resize' },
   { dir: { h: -1, v: 0 }, position: 'left-0 top-1/2', cursor: 'ew-resize' },
   { dir: { h: 1, v: 0 }, position: 'right-0 top-1/2', cursor: 'ew-resize' },
   { dir: { h: -1, v: 1 }, position: 'left-0 bottom-0', cursor: 'nesw-resize' },
   { dir: { h: 0, v: 1 }, position: 'left-1/2 bottom-0', cursor: 'ns-resize' },
   { dir: { h: 1, v: 1 }, position: 'right-0 bottom-0', cursor: 'nwse-resize' },
];

interface BoardItemBoxProps {
   item: BoardItem;
   isSelected: boolean;
   /** Whether this item is already the frontmost; a plain click on it then needs no raise. */
   isFrontmost: boolean;
   /** Current zoom, so screen deltas convert to world deltas and handles stay screen-constant. */
   zoom: number;
   onSelect: (id: string) => void;
   onMove: (id: string, position: { x: number; y: number }) => void;
   onResize: (id: string, patch: ResizePatch) => void;
   onUpdateContent: (id: string, content: BoardItemContent) => void;
   onBringToFront: (id: string) => void;
   onSendToBack: (id: string) => void;
   onDelete: (id: string) => void;
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
   onBringToFront,
   onSendToBack,
   onDelete,
}: BoardItemBoxProps) {
   const { t } = useTranslation();

   // Live gesture state for rendering; the commit reads from refs (below) so it never
   // depends on a stale handler closure. `moveOffset` is a world-space delta during a
   // move; `resizeRect` is the full live rect during a resize. Only one is active.
   const [moveOffset, setMoveOffset] = useState<{ x: number; y: number } | null>(null);
   const [resizeRect, setResizeRect] = useState<DragRect | null>(null);
   const moveStart = useRef<{ x: number; y: number; moved: boolean; offset: { x: number; y: number } } | null>(null);
   const resizeStart = useRef<{ x: number; y: number; dir: HandleDir; orig: DragRect; rect: DragRect } | null>(null);

   // The rect to render: a live resize wins, else the base rect plus any move offset.
   const rect: DragRect = resizeRect ?? {
      x: item.x + (moveOffset?.x ?? 0),
      y: item.y + (moveOffset?.y ?? 0),
      width: item.width,
      height: item.height,
   };

   // ==================
   //  Move
   // ==================

   const handleBodyPointerDown = (event: ReactPointerEvent) => {
      event.stopPropagation(); // don't start a background pan
      onSelect(item.id);
      moveStart.current = { x: event.clientX, y: event.clientY, moved: false, offset: { x: 0, y: 0 } };
      setMoveOffset({ x: 0, y: 0 });
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleBodyPointerMove = (event: ReactPointerEvent) => {
      const start = moveStart.current;
      if (!start) return;
      const delta = screenDeltaToWorld(event.clientX - start.x, event.clientY - start.y, zoom);
      if (delta.x !== 0 || delta.y !== 0) start.moved = true;
      start.offset = delta;
      setMoveOffset(delta);
   };

   const handleBodyPointerUp = (event: ReactPointerEvent) => {
      const start = moveStart.current;
      moveStart.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (start?.moved) {
         // One drag = one command, dispatched only on release (the offset comes from the
         // ref, never a stale closure).
         onMove(item.id, { x: item.x + start.offset.x, y: item.y + start.offset.y });
      } else if (!isFrontmost) {
         // A plain click (no drag) raises the item, after the gesture so no mid-drag reorder.
         onBringToFront(item.id);
      }
      setMoveOffset(null);
   };

   // ==================
   //  Resize
   // ==================

   const handleResizePointerDown = (event: ReactPointerEvent, dir: HandleDir) => {
      event.stopPropagation();
      onSelect(item.id);
      const orig = { x: item.x, y: item.y, width: item.width, height: item.height };
      resizeStart.current = { x: event.clientX, y: event.clientY, dir, orig, rect: orig };
      setResizeRect(orig);
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleResizePointerMove = (event: ReactPointerEvent) => {
      const start = resizeStart.current;
      if (!start) return;
      const delta = screenDeltaToWorld(event.clientX - start.x, event.clientY - start.y, zoom);
      const next = computeResize(start.orig, start.dir, delta);
      start.rect = next;
      setResizeRect(next);
   };

   const handleResizePointerUp = (event: ReactPointerEvent) => {
      const start = resizeStart.current;
      resizeStart.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (start) {
         // Only carry x/y in the patch when this handle actually moved that edge.
         const patch: ResizePatch = { width: start.rect.width, height: start.rect.height };
         if (start.dir.h === -1) patch.x = start.rect.x;
         if (start.dir.v === -1) patch.y = start.rect.y;
         onResize(item.id, patch);
      }
      setResizeRect(null);
   };

   // ==================
   //  Render
   // ==================

   const handleSize = HANDLE_SCREEN_SIZE / zoom;

   return (
      <div
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
            onPointerMove={handleBodyPointerMove}
            onPointerUp={handleBodyPointerUp}
            className={cn(
               'h-full w-full select-none overflow-hidden rounded-md border shadow-sm',
               isSelected ? 'border-primary ring-2 ring-primary cursor-move' : 'border-border cursor-pointer hover:border-primary/50',
            )}
         >
            <BoardItemBody
               item={item}
               isSelected={isSelected}
               onContentChange={(content) => onUpdateContent(item.id, content)}
               onRequestSelect={() => onSelect(item.id)}
            />
         </div>

         {isSelected && (
            <>
               {/* Selection action toolbar, counter-scaled so it stays screen-constant. */}
               <div
                  className="absolute left-0 flex gap-1"
                  style={{ bottom: '100%', transformOrigin: '0 100%', transform: `scale(${1 / zoom})` }}
               >
                  <SelectionButton title={t('BoardView.bringToFront')} onClick={() => onBringToFront(item.id)}>
                     <ArrowUpToLine className="h-3.5 w-3.5" />
                  </SelectionButton>
                  <SelectionButton title={t('BoardView.sendToBack')} onClick={() => onSendToBack(item.id)}>
                     <ArrowDownToLine className="h-3.5 w-3.5" />
                  </SelectionButton>
                  <SelectionButton title={t('BoardView.deleteItem')} destructive onClick={() => onDelete(item.id)}>
                     <Trash2 className="h-3.5 w-3.5" />
                  </SelectionButton>
               </div>

               {/* Resize handles, counter-scaled to a constant on-screen size. */}
               {RESIZE_HANDLES.map(({ dir, position, cursor }) => (
                  <div
                     key={`${dir.h}:${dir.v}`}
                     onPointerDown={(event) => handleResizePointerDown(event, dir)}
                     onPointerMove={handleResizePointerMove}
                     onPointerUp={handleResizePointerUp}
                     className={cn('absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border border-background bg-primary', position)}
                     style={{ width: handleSize, height: handleSize, cursor }}
                  />
               ))}
            </>
         )}
      </div>
   );
}

/** A small frosted button in the selection toolbar. */
function SelectionButton({
   title,
   destructive = false,
   onClick,
   children,
}: {
   title: string;
   destructive?: boolean;
   onClick: () => void;
   children: React.ReactNode;
}) {
   return (
      <button
         type="button"
         title={title}
         aria-label={title}
         // Stop the pointer from starting a move/pan; click still fires.
         onPointerDown={(event) => event.stopPropagation()}
         onClick={onClick}
         className={cn(
            'flex items-center justify-center rounded p-1 shadow-sm cursor-pointer',
            destructive
               ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
               : 'bg-primary text-primary-foreground hover:bg-primary/90',
         )}
      >
         {children}
      </button>
   );
}

/** Applies a resize delta to the original rect for `dir`, enforcing the min size (pinning the opposite edge). */
function computeResize(orig: DragRect, dir: HandleDir, delta: { x: number; y: number }): DragRect {
   let { x, y, width, height } = orig;

   if (dir.h === 1) {
      width = Math.max(MIN_ITEM_SIZE, orig.width + delta.x);
   } else if (dir.h === -1) {
      width = Math.max(MIN_ITEM_SIZE, orig.width - delta.x);
      x = orig.x + orig.width - width; // pin the right edge
   }

   if (dir.v === 1) {
      height = Math.max(MIN_ITEM_SIZE, orig.height + delta.y);
   } else if (dir.v === -1) {
      height = Math.max(MIN_ITEM_SIZE, orig.height - delta.y);
      y = orig.y + orig.height - height; // pin the bottom edge
   }

   return { x, y, width, height };
}
