// -- React Imports --
import { useState, useEffect } from 'react';

// -- Component Imports --
import { ChannelSlider } from './ChannelSlider';

/*
 * One labelled color channel: a slider plus a numeric input that commit the same value.
 * Ported from Documinter. The local `raw` buffer lets the input hold an in-progress edit
 * and resync when the channel changes elsewhere (slider drag, mode switch).
 */

export interface ChannelRowProps {
   label: string;
   labelColor: string;
   value: number;
   min: number;
   max: number;
   gradient: string;
   onChange: (value: number) => void;
}

export function ChannelRow({ label, labelColor, value, min, max, gradient, onChange }: ChannelRowProps) {
   const [raw, setRaw] = useState(String(value));
   // Resync the input buffer when the channel value changes from outside the input.
   useEffect(() => { setRaw(String(value)); }, [value]);

   function commit(rawValue: string) {
      const parsed = parseInt(rawValue, 10);
      if (!isNaN(parsed)) onChange(Math.max(min, Math.min(max, parsed)));
      setRaw(String(value));
   }

   return (
      <div className="flex items-center gap-2">
         <span className="w-4 select-none text-center font-mono text-xs font-bold" style={{ color: labelColor }}>
            {label}
         </span>
         <ChannelSlider value={value} min={min} max={max} gradient={gradient} onChange={onChange} />
         <input
            type="text"
            inputMode="numeric"
            value={raw}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => setRaw(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') commit((event.target as HTMLInputElement).value); }}
            className="w-9 border-none bg-transparent text-right font-mono text-xs text-foreground outline-none"
         />
      </div>
   );
}
