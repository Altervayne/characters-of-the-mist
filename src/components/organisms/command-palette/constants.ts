// -- Type Imports --
import type { Variants } from 'framer-motion';

/** Shared className applied to every selectable command palette item. */
export const commonItemClass = "flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground";

/** Entry/exit animation variants for the command palette container. */
export const commandVariants: Variants = {
   hidden: { opacity: 0, y: -30, scale: 0.95 },
   visible: { opacity: 1, y: 0, scale: 1 },
};
