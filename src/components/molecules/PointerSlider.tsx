// -- React Imports --
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

// -- Local Imports --
import { cn } from '@/lib/utils';

/*
 * A pointer-driven 1D slider: a themed track with a filled portion and a thumb. The same
 * capture/pick idiom as the color ChannelSlider, but neutral (track + fill on tokens) and
 * float-capable, so it drives things like a crop zoom. No native range input, so it behaves
 * identically under mouse and touch. The pointer math reads the ref in the handler.
 */

export interface PointerSliderProps {
   value: number;
   min: number;
   max: number;
   /** Optional quantization; omit for a continuous value. */
   step?: number;
   onChange: (value: number) => void;
   label: string;
   className?: string;
}

export function PointerSlider({ value, min, max, step, onChange, label, className }: PointerSliderProps) {
   const ref = useRef<HTMLDivElement>(null);

   function pick(event: ReactPointerEvent<HTMLDivElement>) {
      const el = ref.current;
      if (!el) return;
      const bounds = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const raw = min + ratio * (max - min);
      const next = step ? Math.round(raw / step) * step : raw;
      onChange(Math.max(min, Math.min(max, next)));
   }

   const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

   return (
      <div
         ref={ref}
         role="slider"
         aria-label={label}
         aria-valuemin={min}
         aria-valuemax={max}
         aria-valuenow={value}
         className={cn('relative h-2 flex-1 cursor-pointer touch-none rounded-full bg-muted', className)}
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
         <div className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
         <div
            className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{ left: `${pct}%`, boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }}
         />
      </div>
   );
}
