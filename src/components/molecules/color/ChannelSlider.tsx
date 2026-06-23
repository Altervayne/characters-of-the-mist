// -- React Imports --
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

/*
 * A draggable 1D track for one color channel (a gradient with a thumb). Ported from
 * Documinter. The pointer math reads the ref in the handler (never during render).
 */

export interface ChannelSliderProps {
   value: number;
   min: number;
   max: number;
   gradient: string;
   onChange: (value: number) => void;
}

export function ChannelSlider({ value, min, max, gradient, onChange }: ChannelSliderProps) {
   const ref = useRef<HTMLDivElement>(null);

   function pick(event: ReactPointerEvent<HTMLDivElement>) {
      const el = ref.current;
      if (!el) return;
      const bounds = el.getBoundingClientRect();
      const positionRatio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      onChange(Math.round(min + positionRatio * (max - min)));
   }

   const pct = ((value - min) / (max - min)) * 100;

   return (
      <div
         ref={ref}
         className="relative h-2 flex-1 cursor-pointer rounded-full touch-none"
         style={{ background: gradient }}
         onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            pick(event);
         }}
         onPointerMove={(event) => {
            if (event.buttons === 0) return;
            pick(event);
         }}
      >
         <div
            className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{ left: `${pct}%`, boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }}
         />
      </div>
   );
}
