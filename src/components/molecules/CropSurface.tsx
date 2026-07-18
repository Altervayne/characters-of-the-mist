// -- React Imports --
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

// -- Type Imports --
import type { CropRegion } from '@/lib/assets/cropImage';

/*
 * The crop stage: the whole image shows fitted (letterboxed) in the stage, with a rectangle over it
 * that drags to move and resizes from 8 handles. FREE zones resize to any ratio; a locked zone keeps
 * its aspect on the corner handles (edge handles are hidden so the ratio can't be broken). The rect is
 * tracked in the ROTATED image's pixel space, which is exactly what {@link cropImage} cuts from - so its
 * reported region needs no remapping. Pointer-driven (mouse + touch alike), with padded hit targets.
 *
 * The frame's fixed over-photo colors (scrim, stroke, handles, grid) are the only non-token colors here:
 * they must read on an arbitrary image, the same justification as the color picker's white thumb.
 */

/** Smallest rect edge, in source px, the handles allow; the too-small guard downstream blocks tiny cuts. */
const MIN_EDGE_PX = 24;
/** Padded pointer target around each handle nub, so touch clears the 44px mark. */
const HANDLE_HIT_PX = 44;

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface HandleSpec {
   id: HandleId;
   /** Normalized position on the rect (0..1). */
   fx: number;
   fy: number;
   corner: boolean;
   cursor: string;
}

const HANDLES: HandleSpec[] = [
   { id: 'nw', fx: 0, fy: 0, corner: true, cursor: 'nwse-resize' },
   { id: 'n', fx: 0.5, fy: 0, corner: false, cursor: 'ns-resize' },
   { id: 'ne', fx: 1, fy: 0, corner: true, cursor: 'nesw-resize' },
   { id: 'e', fx: 1, fy: 0.5, corner: false, cursor: 'ew-resize' },
   { id: 'se', fx: 1, fy: 1, corner: true, cursor: 'nwse-resize' },
   { id: 's', fx: 0.5, fy: 1, corner: false, cursor: 'ns-resize' },
   { id: 'sw', fx: 0, fy: 1, corner: true, cursor: 'nesw-resize' },
   { id: 'w', fx: 0, fy: 0.5, corner: false, cursor: 'ew-resize' },
];

interface Rect {
   x: number;
   y: number;
   width: number;
   height: number;
}

interface DragState {
   kind: 'move' | HandleId;
   startEff: { x: number; y: number };
   startRect: Rect;
}

interface CropSurfaceProps {
   /** Object URL of the source, shown fitted in the stage. */
   image: string;
   /** Source pixel dimensions (EXIF-oriented). */
   sourceWidth: number;
   sourceHeight: number;
   /** Clockwise rotation in degrees (0, 90, 180, 270). */
   rotation: number;
   /** Locked width/height ratio, or `undefined` for a free crop. */
   aspect?: number;
   /** Bumping this restores the default framing (drives the dialog's Reset). */
   resetKey?: number;
   /** Reports the crop rect in rotated-source pixel space. */
   onCropChange: (region: CropRegion) => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** The default rect: the whole image (free) or the largest centered rect of `aspect` (locked). */
function defaultRect(effW: number, effH: number, aspect?: number): Rect {
   if (!aspect) return { x: 0, y: 0, width: effW, height: effH };
   let width = effW;
   let height = effW / aspect;
   if (height > effH) {
      height = effH;
      width = effH * aspect;
   }
   return { x: (effW - width) / 2, y: (effH - height) / 2, width, height };
}

/** Identifies a framing: a change here (rotation, source, lock, or Reset) re-defaults the rect. */
const framingKey = (effW: number, effH: number, aspect: number | undefined, resetKey: number | undefined) =>
   `${effW}x${effH}:${aspect ?? 'free'}:${resetKey ?? 0}`;

export function CropSurface({ image, sourceWidth, sourceHeight, rotation, aspect, resetKey, onCropChange }: CropSurfaceProps) {
   const stageRef = useRef<HTMLDivElement>(null);
   const dragRef = useRef<DragState | null>(null);

   // Rotating by 90/270 swaps the image's footprint; the rect lives in that rotated space.
   const rotated = rotation % 180 !== 0;
   const effW = rotated ? sourceHeight : sourceWidth;
   const effH = rotated ? sourceWidth : sourceHeight;

   const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
   const [rect, setRect] = useState<Rect>(() => defaultRect(effW, effH, aspect));
   const [frame, setFrame] = useState(() => framingKey(effW, effH, aspect, resetKey));

   // A new image, rotation, lock, or Reset restores the default framing (adjusted during render, not an effect).
   const currentFrame = framingKey(effW, effH, aspect, resetKey);
   if (currentFrame !== frame) {
      setFrame(currentFrame);
      setRect(defaultRect(effW, effH, aspect));
   }

   // Track the stage's pixel box so screen<->source mapping stays correct across resizes.
   useLayoutEffect(() => {
      const el = stageRef.current;
      if (!el) return;
      const measure = () => setStageSize({ width: el.clientWidth, height: el.clientHeight });
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
   }, []);

   // Report the rect (rounded to whole source px) whenever it settles.
   useEffect(() => {
      onCropChange({
         x: Math.round(rect.x),
         y: Math.round(rect.y),
         width: Math.round(rect.width),
         height: Math.round(rect.height),
      });
   }, [rect, onCropChange]);

   if (effW <= 0 || effH <= 0) return <div ref={stageRef} className="h-full w-full" />;

   const fitScale = stageSize ? Math.min(stageSize.width / effW, stageSize.height / effH) : 0;
   const displayW = effW * fitScale;
   const displayH = effH * fitScale;
   const offsetX = stageSize ? (stageSize.width - displayW) / 2 : 0;
   const offsetY = stageSize ? (stageSize.height - displayH) / 2 : 0;

   // The rotated image fills the fitted box; for 90/270 its pre-rotation footprint is transposed.
   const imageW = rotated ? displayH : displayW;
   const imageH = rotated ? displayW : displayH;

   /** Maps a pointer event to rotated-source coords, clamped to the image. */
   function pointerToEff(event: ReactPointerEvent): { x: number; y: number } {
      const bounds = stageRef.current!.getBoundingClientRect();
      return {
         x: clamp((event.clientX - bounds.left - offsetX) / fitScale, 0, effW),
         y: clamp((event.clientY - bounds.top - offsetY) / fitScale, 0, effH),
      };
   }

   function beginDrag(event: ReactPointerEvent, kind: DragState['kind']) {
      if (!fitScale) return;
      event.stopPropagation();
      // Capture keeps the drag alive past the stage edge; a failed capture just falls back to plain moves.
      try {
         stageRef.current?.setPointerCapture(event.pointerId);
      } catch {
         /* pointer already released */
      }
      dragRef.current = { kind, startEff: pointerToEff(event), startRect: rect };
   }

   function onPointerMove(event: ReactPointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const eff = pointerToEff(event);
      setRect(drag.kind === 'move' ? moveRect(drag.startRect, drag.startEff, eff, effW, effH) : resizeRect(drag, eff, effW, effH, aspect));
   }

   function endDrag(event: ReactPointerEvent) {
      if (!dragRef.current) return;
      try {
         stageRef.current?.releasePointerCapture(event.pointerId);
      } catch {
         /* capture never took */
      }
      dragRef.current = null;
   }

   const showRect = fitScale > 0;
   const rectStyle = { left: offsetX + rect.x * fitScale, top: offsetY + rect.y * fitScale, width: rect.width * fitScale, height: rect.height * fitScale };

   return (
      <div
         ref={stageRef}
         className="relative h-full w-full touch-none overflow-hidden select-none"
         onPointerMove={onPointerMove}
         onPointerUp={endDrag}
         onPointerCancel={endDrag}
      >
         {stageSize && (
            <img
               src={image}
               alt=""
               draggable={false}
               className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
               style={{ width: imageW, height: imageH, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
            />
         )}

         {showRect && (
            <div
               className="absolute cursor-move"
               style={{ ...rectStyle, boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 0 0 9999px rgba(0,0,0,0.5)', outline: '2px solid rgba(255,255,255,0.9)', outlineOffset: '-1px' }}
               onPointerDown={(event) => beginDrag(event, 'move')}
            >
               {/* Thirds guide. */}
               <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
                  <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
                  <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
                  <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
               </div>

               {HANDLES.filter((handle) => !aspect || handle.corner).map((handle) => (
                  <div
                     key={handle.id}
                     className="absolute -translate-x-1/2 -translate-y-1/2 touch-none"
                     style={{ left: `${handle.fx * 100}%`, top: `${handle.fy * 100}%`, width: HANDLE_HIT_PX, height: HANDLE_HIT_PX, cursor: handle.cursor }}
                     onPointerDown={(event) => beginDrag(event, handle.id)}
                  >
                     <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/40 bg-white" />
                  </div>
               ))}
            </div>
         )}
      </div>
   );
}

/** Moves the rect by the drag delta, clamped so it stays fully inside the image. */
function moveRect(startRect: Rect, startEff: { x: number; y: number }, eff: { x: number; y: number }, effW: number, effH: number): Rect {
   return {
      ...startRect,
      x: clamp(startRect.x + (eff.x - startEff.x), 0, effW - startRect.width),
      y: clamp(startRect.y + (eff.y - startEff.y), 0, effH - startRect.height),
   };
}

/** Resizes the rect from a handle: free edges in FREE mode, aspect-preserving corners in LOCKED mode. */
function resizeRect(drag: DragState, eff: { x: number; y: number }, effW: number, effH: number, aspect?: number): Rect {
   const handle = drag.kind as HandleId;
   const { startRect } = drag;
   const start = { left: startRect.x, top: startRect.y, right: startRect.x + startRect.width, bottom: startRect.y + startRect.height };

   if (aspect) {
      // Anchor the opposite corner; the dragged corner follows the pointer, contained to the ratio.
      const anchorX = handle === 'nw' || handle === 'sw' ? start.right : start.left;
      const anchorY = handle === 'nw' || handle === 'ne' ? start.bottom : start.top;
      const dirX = handle === 'ne' || handle === 'se' ? 1 : -1;
      const dirY = handle === 'se' || handle === 'sw' ? 1 : -1;

      let width = Math.min(Math.abs(eff.x - anchorX), Math.abs(eff.y - anchorY) * aspect);
      let height = width / aspect;
      if (width < MIN_EDGE_PX) {
         width = MIN_EDGE_PX;
         height = width / aspect;
      }
      const maxW = dirX > 0 ? effW - anchorX : anchorX;
      const maxH = dirY > 0 ? effH - anchorY : anchorY;
      const shrink = Math.min(maxW / width, maxH / height, 1);
      width *= shrink;
      height *= shrink;

      const cornerX = anchorX + dirX * width;
      const cornerY = anchorY + dirY * height;
      return { x: Math.min(anchorX, cornerX), y: Math.min(anchorY, cornerY), width, height };
   }

   let { left, top, right, bottom } = start;
   if (handle === 'nw' || handle === 'w' || handle === 'sw') left = clamp(eff.x, 0, right - MIN_EDGE_PX);
   if (handle === 'nw' || handle === 'n' || handle === 'ne') top = clamp(eff.y, 0, bottom - MIN_EDGE_PX);
   if (handle === 'ne' || handle === 'e' || handle === 'se') right = clamp(eff.x, left + MIN_EDGE_PX, effW);
   if (handle === 'sw' || handle === 's' || handle === 'se') bottom = clamp(eff.y, top + MIN_EDGE_PX, effH);
   return { x: left, y: top, width: right - left, height: bottom - top };
}
