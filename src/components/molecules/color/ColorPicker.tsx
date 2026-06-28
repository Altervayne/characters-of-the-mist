/* eslint-disable react-hooks/refs --
   Sticky-ref pattern: sHsvH, sHslH/S, sCmykC/M/Y are read during render on purpose, to
   drive the thumb positions and channel gradients. A re-render always follows a setRgb()
   in an event handler, so the values are current. The refs deliberately bypass the RGB
   round-trip, which would otherwise drift the hue on degenerate colors (black, white,
   gray all convert to hue 0). Do not "fix" this - it is load-bearing. */

// -- React Imports --
import { useState, useRef, useEffect, useCallback, type PointerEvent as ReactPointerEvent } from 'react';

// -- Utils Imports --
import { cmykToRgb, hexToRgb, hslToRgb, hsvToRgb, rgbToCmyk, rgbToHex, rgbToHsl, rgbToHsv } from '@/lib/color';

// -- Component Imports --
import { ChannelRow } from './ChannelRow';

/*
 * A dependency-free color picker: an SV square + hue bar, plus hex / rgb / hsl / cmyk
 * tabs. Internal RGB is the single source of truth; everything else derives from it.
 * The pure conversions live in `@/lib/color` (shared with theme derivation); only the
 * stateful sticky-hue logic that preserves hue through black/white/gray stays here.
 */

// ==================
//  Component
// ==================

type ColorMode = 'hex' | 'rgb' | 'hsl' | 'cmyk';
const MODES: ColorMode[] = ['hex', 'rgb', 'hsl', 'cmyk'];

interface ColorPickerProps {
   value: string;
   onChange: (hex: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
   const [mode, setMode] = useState<ColorMode>('hex');

   // Internal RGB is the source of truth; it avoids the prop -> hex -> derive feedback loop
   // that produces degenerate conversions (e.g. hsl(*, *, 100%) always collapses to white).
   const emittedHex = useRef(value);
   const [rgb, setRgb] = useState<[number, number, number]>(() => hexToRgb(value) ?? [249, 115, 22]);

   const [red, green, blue] = rgb;
   const [, hsvSaturation, hsvValue] = rgbToHsv(red, green, blue);
   const [, , hslLightness] = rgbToHsl(red, green, blue);
   const [cyan, magenta, yellow, black] = rgbToCmyk(red, green, blue);

   // Sticky refs preserve hue/saturation through degenerate colors (black/white/gray).
   // Updated only in handlers and on an external value change, never from RGB round-trips.
   const sHsvH = useRef(rgbToHsv(red, green, blue)[0]);
   const sHslH = useRef(rgbToHsl(red, green, blue)[0]);
   const sHslS = useRef(rgbToHsl(red, green, blue)[1]);
   const sCmykC = useRef(cyan);
   const sCmykM = useRef(magenta);
   const sCmykY = useRef(yellow);

   // Sync from external prop changes only (not our own emissions); refresh the sticky refs too.
   useEffect(() => {
      if (value !== emittedHex.current) {
         const parsed = hexToRgb(value);
         if (parsed) {
            setRgb(parsed);
            const [newHsvH, newHsvS, newHsvV] = rgbToHsv(...parsed);
            const [newHslH, newHslS, newHslL] = rgbToHsl(...parsed);
            const [newCyan, newMagenta, newYellow, newBlack] = rgbToCmyk(...parsed);
            if (newHsvS > 0 && newHsvV > 0) sHsvH.current = newHsvH;
            if (newHslL > 0 && newHslL < 100) { sHslH.current = newHslH; if (newHslS > 0) sHslS.current = newHslS; }
            if (newBlack < 100) { sCmykC.current = newCyan; sCmykM.current = newMagenta; sCmykY.current = newYellow; }
         }
      }
   }, [value]);

   const pureHue = rgbToHex(...hsvToRgb(sHsvH.current, 100, 100));

   const emit = useCallback((newRgb: [number, number, number]) => {
      const hex = rgbToHex(...newRgb);
      emittedHex.current = hex;
      setRgb(newRgb);
      onChange(hex);
   }, [onChange]);

   const svRef = useRef<HTMLDivElement>(null);
   const hueRef = useRef<HTMLDivElement>(null);

   function pickSV(event: ReactPointerEvent<HTMLDivElement>) {
      const el = svRef.current; if (!el) return;
      const rect = el.getBoundingClientRect();
      const newSaturation = Math.round(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 100);
      const newValue = Math.round(Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height)) * 100);
      emit(hsvToRgb(sHsvH.current, newSaturation, newValue));
   }

   function pickHue(event: ReactPointerEvent<HTMLDivElement>) {
      const el = hueRef.current; if (!el) return;
      const rect = el.getBoundingClientRect();
      const newHue = Math.round(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 360);
      sHsvH.current = newHue;
      emit(hsvToRgb(newHue, hsvSaturation, hsvValue));
   }

   const currentHex = rgbToHex(red, green, blue);
   const [hexRaw, setHexRaw] = useState(currentHex.replace('#', ''));
   useEffect(() => { setHexRaw(currentHex.replace('#', '')); }, [currentHex]);

   return (
      <div className="flex select-none flex-col gap-2.5">
         {/* SV square */}
         <div
            ref={svRef}
            className="relative w-full cursor-crosshair overflow-hidden rounded-md touch-none"
            style={{ height: 120, background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, ${pureHue})` }}
            onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); pickSV(event); }}
            onPointerMove={(event) => { if (event.buttons === 0) return; pickSV(event); }}
         >
            <div
               className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
               style={{ left: `${hsvSaturation}%`, top: `${100 - hsvValue}%`, boxShadow: '0 0 0 1px rgba(0,0,0,0.35)' }}
            />
         </div>

         {/* Hue bar */}
         <div
            ref={hueRef}
            className="relative h-3 w-full cursor-pointer rounded-full touch-none"
            style={{ background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
            onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); pickHue(event); }}
            onPointerMove={(event) => { if (event.buttons === 0) return; pickHue(event); }}
         >
            <div
               className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
               style={{ left: `${(sHsvH.current / 360) * 100}%`, background: pureHue, boxShadow: '0 0 0 1px rgba(0,0,0,0.35)' }}
            />
         </div>

         {/* Mode tabs */}
         <div className="flex gap-0.5 rounded-lg border border-border/60 bg-background p-0.5">
            {MODES.map((colorMode) => (
               <button
                  key={colorMode}
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setMode(colorMode)}
                  className={`flex-1 rounded-md py-1 font-mono text-xs font-semibold uppercase tracking-wide transition-colors ${mode === colorMode ? 'bg-popover text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
               >
                  {colorMode}
               </button>
            ))}
         </div>

         {/* Mode content */}
         <div className="flex flex-col gap-2">
            {mode === 'hex' && (
               <div className="flex items-center gap-2">
                  <div className="h-7 w-7 shrink-0 rounded-md border border-border/60" style={{ background: currentHex }} />
                  <div className="flex flex-1 items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5">
                     <span className="font-mono text-xs text-muted-foreground">#</span>
                     <input
                        type="text"
                        value={hexRaw}
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) => {
                           const cleaned = event.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6);
                           setHexRaw(cleaned);
                           if (cleaned.length === 6) {
                              const parsed = hexToRgb('#' + cleaned);
                              if (parsed) emit(parsed);
                           }
                        }}
                        maxLength={6}
                        spellCheck={false}
                        className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground outline-none"
                        placeholder="rrggbb"
                     />
                  </div>
               </div>
            )}

            {mode === 'rgb' && (
               <>
                  <ChannelRow label="R" labelColor="#e55" value={red} min={0} max={255}
                     gradient={`linear-gradient(to right, rgb(0,${green},${blue}), rgb(255,${green},${blue}))`}
                     onChange={(channel) => emit([channel, green, blue])} />
                  <ChannelRow label="G" labelColor="#5a5" value={green} min={0} max={255}
                     gradient={`linear-gradient(to right, rgb(${red},0,${blue}), rgb(${red},255,${blue}))`}
                     onChange={(channel) => emit([red, channel, blue])} />
                  <ChannelRow label="B" labelColor="#59f" value={blue} min={0} max={255}
                     gradient={`linear-gradient(to right, rgb(${red},${green},0), rgb(${red},${green},255))`}
                     onChange={(channel) => emit([red, green, channel])} />
               </>
            )}

            {mode === 'hsl' && (
               <>
                  <ChannelRow label="H" labelColor="#aaa" value={sHslH.current} min={0} max={360}
                     gradient="linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
                     onChange={(channel) => { sHslH.current = channel; emit(hslToRgb(channel, sHslS.current, hslLightness)); }} />
                  <ChannelRow label="S" labelColor="#aaa" value={sHslS.current} min={0} max={100}
                     gradient={`linear-gradient(to right, hsl(${sHslH.current},0%,${hslLightness}%), hsl(${sHslH.current},100%,${hslLightness}%))`}
                     onChange={(channel) => { sHslS.current = channel; emit(hslToRgb(sHslH.current, channel, hslLightness)); }} />
                  <ChannelRow label="L" labelColor="#aaa" value={hslLightness} min={0} max={100}
                     gradient={`linear-gradient(to right, hsl(${sHslH.current},${sHslS.current}%,0%), hsl(${sHslH.current},${sHslS.current}%,50%), hsl(${sHslH.current},${sHslS.current}%,100%))`}
                     onChange={(channel) => emit(hslToRgb(sHslH.current, sHslS.current, channel))} />
               </>
            )}

            {mode === 'cmyk' && (
               <>
                  <ChannelRow label="C" labelColor="#22c8d8" value={cyan} min={0} max={100}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(0, sCmykM.current, sCmykY.current, black))}, ${rgbToHex(...cmykToRgb(100, sCmykM.current, sCmykY.current, black))})`}
                     onChange={(channel) => { sCmykC.current = channel; emit(cmykToRgb(channel, sCmykM.current, sCmykY.current, black)); }} />
                  <ChannelRow label="M" labelColor="#e840a0" value={magenta} min={0} max={100}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(sCmykC.current, 0, sCmykY.current, black))}, ${rgbToHex(...cmykToRgb(sCmykC.current, 100, sCmykY.current, black))})`}
                     onChange={(channel) => { sCmykM.current = channel; emit(cmykToRgb(sCmykC.current, channel, sCmykY.current, black)); }} />
                  <ChannelRow label="Y" labelColor="#c8b800" value={yellow} min={0} max={100}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(sCmykC.current, sCmykM.current, 0, black))}, ${rgbToHex(...cmykToRgb(sCmykC.current, sCmykM.current, 100, black))})`}
                     onChange={(channel) => { sCmykY.current = channel; emit(cmykToRgb(sCmykC.current, sCmykM.current, channel, black)); }} />
                  <ChannelRow label="K" labelColor="#888" value={black} min={0} max={100}
                     gradient={`linear-gradient(to right, ${rgbToHex(...cmykToRgb(sCmykC.current, sCmykM.current, sCmykY.current, 0))}, ${rgbToHex(...cmykToRgb(sCmykC.current, sCmykM.current, sCmykY.current, 100))})`}
                     onChange={(channel) => emit(cmykToRgb(sCmykC.current, sCmykM.current, sCmykY.current, channel))} />
               </>
            )}
         </div>
      </div>
   );
}
