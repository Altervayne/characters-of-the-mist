// -- Utils Imports --
import { parseColorToRgb, rgbToHex } from '@/lib/color';

/** Any CSS color -> `#rrggbb` so the picker (hex-based) opens on the current value. */
export function toHex(color: string): string {
   const rgb = parseColorToRgb(color);
   return rgb ? rgbToHex(...rgb) : '#000000';
}
