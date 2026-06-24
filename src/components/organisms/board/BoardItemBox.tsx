// -- React Imports --
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { screenDeltaToWorld } from '@/lib/board/boardCoordinates';
import { MIN_ITEM_SIZE, computeResize, effectiveHeight } from '@/lib/board/boardResize';
import { COLLAPSED_BAR_HEIGHT, COLLAPSED_BAR_WIDTH } from '@/lib/board/zoneCollapse';
import { ZONE_TITLE_BAR_HEIGHT } from './items/ZoneItem';

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

/** Resize-grip hit size in screen px (counter-scaled by zoom so it stays constant on screen). */
const HANDLE_SCREEN_SIZE = 14;

/**
 * Kinds whose content height is the MINIMUM height (no internal scroll): the box measures its
 * content as a floor - it can be dragged taller (2D resize) but never shorter than the content,
 * and auto-grows when the content exceeds the current height. (Reusable by future form-like kinds.)
 */
const MIN_HEIGHT_KINDS = new Set<BoardItemKind>(['dice-tray']);
const isMinHeight = (kind: BoardItemKind): boolean => MIN_HEIGHT_KINDS.has(kind);

interface BoardItemBoxProps {
   item: BoardItem;
   /** In the selection set (draws the ring). */
   isSelected: boolean;
   /** The ONLY selected item: shows the per-item toolbar + resize grip (suppressed in a multi-selection). */
   soleSelected: boolean;
   /** A zone's member count, for its collapsed-bar badge (undefined for non-zones). */
   memberCount?: number;
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
   /** The behind-items layer a zone portals its tinted background rectangle into (null for non-zones). */
   backLayer?: HTMLElement | null;
   /** Lower bound for the resize (a zone passes its member extent); each axis defaults to MIN_ITEM_SIZE. */
   resizeMin?: { width: number; height: number };
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
   memberCount,
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
   backLayer,
   resizeMin,
}: BoardItemBoxProps) {
   // Live resize rect (full rect during a resize); the commit reads from the ref so it
   // never depends on a stale closure. The group move offset is owned by the canvas and
   // arrives as `moveDelta`.
   const [resizeRect, setResizeRect] = useState<DragRect | null>(null);
   const resizeStart = useRef<{ x: number; y: number; orig: DragRect; rect: DragRect } | null>(null);

   // The toolbar's per-kind slot, state-backed so the body re-renders to portal into it
   // once it mounts (and portals nothing while the item is unselected and the bar is gone).
   const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);
   // A non-clipped slot anchored to the box's right edge (outside the body's overflow-hidden),
   // for chrome that must protrude past the box - the journal's bookmark tabs. Always present
   // (tabs show when unselected too); state-backed like the toolbar slot.
   const [sideSlot, setSideSlot] = useState<HTMLDivElement | null>(null);

   const minHeight = isMinHeight(item.kind);
   // For a min-height item the content height is the floor. The measure wrapper fills the body and
   // grows with content (min-h-full); the content's natural height is its height MINUS any flexible
   // fill spacer (a kind that pins a footer marks the spacer with data-board-fill-spacer, and the
   // slack lives in the spacer, not below the content). offsetHeight is layout px = world units,
   // regardless of the world-layer scale. The floor drives the render height and, when content
   // exceeds the stored height, bumps it up via the non-undoable sync; the user can still drag it
   // taller (resizeItem).
   const measureRef = useRef<HTMLDivElement | null>(null);
   const [contentHeight, setContentHeight] = useState(0);
   useEffect(() => {
      if (!minHeight) return;
      const el = measureRef.current;
      if (!el) return;
      // The observer fires on observe(), so the first measure runs without a synchronous setState
      // in the effect body. The spacer is observed too: when content grows inside an already-tall
      // box the wrapper's own size doesn't change, but the spacer shrinks - that must re-measure.
      const measure = () => {
         const spacer = el.querySelector<HTMLElement>('[data-board-fill-spacer]');
         const measured = Math.round(el.offsetHeight - (spacer?.offsetHeight ?? 0));
         if (measured <= 0) return;
         setContentHeight(measured);
         if (measured > item.height) onSyncSize(item.id, { height: measured });
      };
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      const spacer = el.querySelector('[data-board-fill-spacer]');
      if (spacer) observer.observe(spacer);
      return () => observer.disconnect();
   }, [minHeight, item.id, item.height, onSyncSize]);

   // The rect to render: a live resize wins, else the base rect plus any active group-move offset.
   const rect: DragRect = resizeRect ?? {
      x: item.x + (moveDelta?.x ?? 0),
      y: item.y + (moveDelta?.y ?? 0),
      width: item.width,
      height: item.height,
   };

   // ==================
   //  Select (body click)
   // ==================

   const handleBodyPointerDown = (event: ReactPointerEvent) => {
      if (event.button !== 0) return; // right-click selection + menu is handled by the canvas
      event.stopPropagation(); // don't start a background pan
      const additive = event.shiftKey || event.ctrlKey || event.metaKey;
      // Selecting renders the item on top only while selected (a render-only boost in the canvas);
      // stored z is untouched, so deselect returns it to its layer. Only the toolbar's bring-to-
      // front / send-to-back change z. In-body text fields stop propagation, so editing never selects.
      onSelect(item.id, additive);
   };

   // ==================
   //  Resize (single bottom-right grip)
   // ==================

   const handleResizePointerDown = (event: ReactPointerEvent) => {
      if (event.button !== 0) return; // right-click is for the radial menu, not a resize
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
      // 2D resize; a min-height item floors its height at the live content height, and a zone floors
      // both axes at `resizeMin` (its member extent), so neither can be dragged smaller than it holds.
      const next = computeResize(start.orig, delta, {
         width: resizeMin?.width ?? MIN_ITEM_SIZE,
         height: minHeight ? Math.max(MIN_ITEM_SIZE, contentHeight) : resizeMin?.height ?? MIN_ITEM_SIZE,
      });
      start.rect = next;
      setResizeRect(next);
   };

   const handleResizePointerUp = (event: ReactPointerEvent) => {
      const start = resizeStart.current;
      resizeStart.current = null;
      // Commit (and clear the live rect) before releasing capture, so the resize can't be lost
      // if the release throws. Bottom-right only grows the size; x/y never move. The dragged
      // height is the user's (undoable) choice; a min-height item's move already floored it.
      if (start) onResize(item.id, { width: start.rect.width, height: start.rect.height });
      setResizeRect(null);
      event.currentTarget.releasePointerCapture(event.pointerId);
   };

   // ==================
   //  Render
   // ==================

   const gripSize = HANDLE_SCREEN_SIZE / zoom;
   // A pin is a round, fixed-size dot: borderless container, circular ring, no resize grip.
   const isPin = item.kind === 'pin';
   // A card/tracker embed IS its own item: it carries its own border, background, and shape, so the
   // box adds no chrome (no second border/shadow, no grip) - just a selection ring. Fixed at the
   // native size set on drop; overflow is the card's own internal scroll, not a wrapper resize.
   const isEmbed = item.kind === 'card' || item.kind === 'tracker';
   // A zone is a background frame: its tinted rectangle portals BEHIND the items (into `backLayer`),
   // and the box here renders only the on-top header + chrome - click-through everywhere else so the
   // items sitting inside it stay interactive. Selecting the empty interior is the background's job.
   const isZone = item.kind === 'zone';
   const zoneColor = item.content.kind === 'zone' ? item.content.color : undefined;
   // A collapsed zone paints as a compact bar at its origin (frame hidden, members hidden, resize
   // off); its stored width/height are preserved for when it expands.
   const isCollapsedZone = isZone && item.content.kind === 'zone' && item.content.collapsed;
   // A min-height item never renders below its content (the floor); other kinds use their rect.
   const renderHeight = minHeight ? effectiveHeight(rect.height, contentHeight) : rect.height;
   const boxWidth = isCollapsedZone ? COLLAPSED_BAR_WIDTH : rect.width;
   const boxHeight = isCollapsedZone ? COLLAPSED_BAR_HEIGHT : renderHeight;

   const body = (
      <BoardItemBody
         item={item}
         isSelected={isSelected}
         toolbarSlot={toolbarSlot}
         sideSlot={sideSlot}
         memberCount={memberCount}
         onContentChange={(content) => onUpdateContent(item.id, content)}
         onCacheLastKnown={onCacheLastKnown}
         onDelete={onDelete}
         onRequestSelect={() => onSelect(item.id, false)}
      />
   );

   return (
      <div
         data-board-item-id={item.id}
         className={cn('absolute', isZone && !isCollapsedZone && 'pointer-events-none')}
         style={{
            left: rect.x,
            top: rect.y,
            width: boxWidth,
            height: boxHeight,
            transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
         }}
      >
         {/* A zone's tinted rectangle, portaled into the behind-items back layer so members sit on
             top. It tracks the live rect (move/resize), and a pointer-down on its empty interior or
             border selects the zone - items on top capture their own clicks first (they paint above).
             A collapsed zone hides its frame (it's the bar below instead). */}
         {isZone && !isCollapsedZone && backLayer && createPortal(
            <div
               onPointerDown={(event) => { event.stopPropagation(); onSelect(item.id, event.shiftKey || event.ctrlKey || event.metaKey); }}
               className={cn('absolute cursor-pointer rounded-lg border', !zoneColor && 'border-border bg-foreground/[0.04]')}
               style={{
                  left: rect.x,
                  top: rect.y,
                  width: rect.width,
                  height: renderHeight,
                  ...(zoneColor ? { backgroundColor: `${zoneColor}1f`, borderColor: zoneColor } : {}),
               }}
            />,
            backLayer,
         )}

         {/* Non-clipped anchor at the box's right edge, for the journal's bookmark tabs to
             protrude into. Rendered BEFORE the body so the tabs tuck behind the page edge: the
             body (positioned, later sibling) paints over their attach point and the selection
             halo stays unbroken; only the protruding part shows. Zero-size, never grabs clicks. */}
         <div ref={setSideSlot} className="absolute left-full top-0" />

         <div
            onPointerDown={handleBodyPointerDown}
            // A collapsed zone's bar carries the zone's tint (matching the expanded frame) so the
            // color survives collapse; an uncolored zone keeps the neutral card bar.
            style={isCollapsedZone && zoneColor ? { backgroundColor: `${zoneColor}1f`, borderColor: zoneColor } : undefined}
            className={cn(
               'relative h-full w-full select-none',
               // An embed brings its own rounded border, so the box neither clips (which would
               // double-round and crop the flip's back face) nor draws chrome.
               !isZone && !isEmbed && 'overflow-hidden',
               // A collapsed zone IS a solid, clickable bar (the frame is hidden). An expanded zone's
               // body is click-through - the tinted rect + header carry the visuals - with only the
               // selection ring outlining the rectangle. A pin is a round borderless dot; a card/tracker
               // embed is bare (its own visuals) with just a ring; every other kind is a bordered card.
               isCollapsedZone
                  ? cn(
                       'overflow-hidden cursor-pointer rounded-md border shadow-sm',
                       !zoneColor && 'bg-card',
                       isSelected ? 'ring-2 ring-primary' : 'hover:border-primary/50',
                       !zoneColor && (isSelected ? 'border-primary' : 'border-border'),
                    )
                  : isZone
                     ? cn('pointer-events-none rounded-lg', isSelected && 'ring-2 ring-primary')
                     : isPin
                        ? cn('rounded-full', isSelected ? 'ring-2 ring-primary' : 'cursor-pointer')
                        : isEmbed
                           // Match the ring radius to the embed's own corners: a card is rounded-xl, a tracker rounded-lg.
                           ? cn(item.kind === 'card' ? 'rounded-xl' : 'rounded-lg', isSelected ? 'ring-2 ring-primary' : 'cursor-pointer')
                           : cn('rounded-md border shadow-sm', isSelected ? 'border-primary ring-2 ring-primary' : 'border-border cursor-pointer hover:border-primary/50'),
            )}
         >
            {/* A min-height kind fills the body via a flex column (so a pinned footer can sit at
                the bottom and the slack lands in its fill spacer); others render the body plain. */}
            {minHeight ? <div ref={measureRef} className="flex min-h-full w-full flex-col">{body}</div> : body}
         </div>

         {/* Per-item chrome only for the sole selection; a multi-selection uses the group
             toolbar (rendered by the canvas) to avoid clutter, keeping only the rings. The
             wrapper re-enables pointer events for a zone (whose box is click-through). */}
         {soleSelected && (
            <div className={cn(isZone && 'pointer-events-auto')}>
               <BoardItemToolbar
                  zoom={zoom}
                  isMoving={isMoving}
                  // An expanded zone's title bar sits above the frame too; lift the toolbar above it.
                  extraBottom={isZone && !isCollapsedZone ? ZONE_TITLE_BAR_HEIGHT + 4 : 0}
                  onMoveStart={(event) => onMoveStart(item.id, event)}
                  onConnectStart={(event) => onConnectStart(item.id, event)}
                  onBringToFront={() => onBringToFront(item.id)}
                  onSendToBack={() => onSendToBack(item.id)}
                  onDelete={() => onDelete(item.id)}
                  slotRef={setToolbarSlot}
               />

               {/* Single bottom-right resize grip, counter-scaled to a constant on-screen size.
                   A pin is a fixed-size dot, a collapsed zone is bar-sized (expand to resize), and a
                   card/tracker embed is fixed at its native size, so none of them has a grip. */}
               {!isPin && !isCollapsedZone && !isEmbed && (
                  <div
                     onPointerDown={handleResizePointerDown}
                     onPointerMove={handleResizePointerMove}
                     onPointerUp={handleResizePointerUp}
                     className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 rounded-sm border border-background bg-primary"
                     style={{ width: gripSize, height: gripSize, cursor: 'nwse-resize' }}
                  />
               )}
            </div>
         )}
      </div>
   );
}
