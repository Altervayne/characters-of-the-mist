// -- React Imports --
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'framer-motion';

// -- Icon Imports --
import { ArrowLeft } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { radialOffset, ringRadius } from '@/lib/board/radialMenu';

/*
 * The board's right-click radial menu: a ring of icon actions around the cursor, driven by a node
 * tree so a segment can open a sub-ring (e.g. "New" -> the element kinds). Screen-space and portaled
 * to the body, so it's a constant on-screen size regardless of board pan/zoom. A full-viewport
 * backdrop catches the dismiss click; Escape pops one level (or closes at the root). The ring rolls
 * in along its arc (the conveyor) on open and on each submenu step; reduced-motion renders instantly.
 */

/** A terminal action: an icon button that runs `onSelect` (the menu closes after). */
export interface RadialLeaf {
   id: string;
   icon: ReactNode;
   label: string;
   /** Destructive (delete) - rendered in the destructive color. */
   destructive?: boolean;
   onSelect: () => void;
}

/** A branch: an icon button that opens a sub-ring of `children` (no close). */
export interface RadialSubmenu {
   id: string;
   icon: ReactNode;
   label: string;
   children: RadialNode[];
}

export type RadialNode = RadialLeaf | RadialSubmenu;

const isSubmenu = (node: RadialNode): node is RadialSubmenu => 'children' in node;

/** Button size (screen px), the gap to the hover label, and the viewport edge margin. (Radius adapts to the button count.) */
const BUTTON_SIZE = 40;
const LABEL_GAP = 10;
const EDGE_MARGIN = 12;
/** The conveyor sweep: the ring rolls in from this many degrees down to 0. */
const SWEEP_DEG = 26;

interface BoardRadialMenuProps {
   /** The cursor point (viewport coords) the ring centers on, before edge-clamping. */
   screen: { x: number; y: number };
   root: RadialNode[];
   onClose: () => void;
}

export function BoardRadialMenu({ screen, root, onClose }: BoardRadialMenuProps) {
   const { t } = useTranslation();
   const reduce = useReducedMotion() ?? false;
   // The navigation stack: each level is a ring of nodes; the top is the one shown. The menu is a
   // transient overlay (re-mounted per open), so snapshotting `root` at open is fine.
   const [stack, setStack] = useState<RadialNode[][]>([root]);
   const [hovered, setHovered] = useState<number | null>(null);
   const current = stack[stack.length - 1];
   const depth = stack.length;
   // The ring tightens for few options and opens up for more, so a small root isn't flung wide.
   const radius = ringRadius(current.length);

   const pop = () => { setHovered(null); setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)); };

   useEffect(() => {
      const onKey = (event: KeyboardEvent) => {
         if (event.key !== 'Escape') return;
         // Escape steps back one level when deep, else closes the whole menu.
         setStack((s) => { if (s.length > 1) { setHovered(null); return s.slice(0, -1); } onClose(); return s; });
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
   }, [onClose]);

   // The conveyor: animate the ring's angle offset from the sweep down to 0 on every level change,
   // so the buttons roll into their slots along the arc. Reduced motion holds it at 0.
   const sweep = useMotionValue(reduce ? 0 : SWEEP_DEG);
   useEffect(() => {
      if (reduce) { sweep.set(0); return; }
      sweep.set(SWEEP_DEG);
      const controls = animate(sweep, 0, { duration: 0.26, ease: 'easeOut' });
      return () => controls.stop();
   }, [depth, reduce, sweep]);

   // Shift the whole ring in so it stays fully on-screen near a viewport edge.
   const reach = radius + BUTTON_SIZE / 2 + EDGE_MARGIN;
   const cx = Math.min(Math.max(screen.x, reach), window.innerWidth - reach);
   const cy = Math.min(Math.max(screen.y, reach), window.innerHeight - reach);

   const activate = (node: RadialNode) => {
      if (isSubmenu(node)) { setHovered(null); setStack((s) => [...s, node.children]); return; }
      node.onSelect();
      onClose();
   };

   // The hovered label rides just OUTSIDE its button, along the button's angle, growing away from
   // the center (so a long localized word has room and never fights the middle).
   const hoveredLabel = (() => {
      if (hovered == null || !current[hovered]) return null;
      const at = radialOffset(hovered, current.length, radius + BUTTON_SIZE / 2 + LABEL_GAP, 0);
      // Anchor by the edge nearest the center so the chip extends outward.
      const tx = at.x > 1 ? '0' : at.x < -1 ? '-100%' : '-50%';
      return { label: current[hovered].label, at, tx };
   })();

   return createPortal(
      // The backdrop catches an outside-click (or a second right-click) to dismiss entirely.
      <div className="fixed inset-0 z-50" onPointerDown={onClose} onContextMenu={(event) => { event.preventDefault(); onClose(); }}>
         <div className="absolute" style={{ left: cx, top: cy }} onPointerDown={(event) => event.stopPropagation()}>
            {/* Center back control inside a submenu; arrow-only so it never needs to fit a word. */}
            {depth > 1 && (
               <button
                  type="button"
                  title={t('Common.back')}
                  aria-label={t('Common.back')}
                  onClick={pop}
                  style={{ left: 0, top: 0, marginLeft: -BUTTON_SIZE / 2, marginTop: -BUTTON_SIZE / 2, width: BUTTON_SIZE, height: BUTTON_SIZE }}
                  className="absolute flex items-center justify-center rounded-full border border-border bg-popover/90 text-popover-foreground shadow-md backdrop-blur-sm hover:bg-muted cursor-pointer"
               >
                  <ArrowLeft className="h-4 w-4" />
               </button>
            )}

            {hoveredLabel && (
               <span
                  style={{ left: hoveredLabel.at.x, top: hoveredLabel.at.y, transform: `translate(${hoveredLabel.tx}, -50%)` }}
                  className="absolute whitespace-nowrap rounded-md border border-border bg-popover/95 px-2 py-0.5 text-xs text-popover-foreground shadow-sm backdrop-blur-sm"
               >
                  {hoveredLabel.label}
               </span>
            )}

            {/* Keyed by depth so the buttons re-mount (and the stagger replays) on each navigation. */}
            <div key={depth}>
               {current.map((node, i) => (
                  <RadialButton
                     key={node.id}
                     node={node}
                     index={i}
                     count={current.length}
                     radius={radius}
                     sweep={sweep}
                     reduce={reduce}
                     onActivate={() => activate(node)}
                     onHover={() => setHovered(i)}
                     onHoverEnd={() => setHovered((c) => (c === i ? null : c))}
                  />
               ))}
            </div>
         </div>
      </div>,
      document.body,
   );
}

/** One ring button: rides into its slot along the arc (its position derives from the live sweep). */
function RadialButton({
   node,
   index,
   count,
   radius,
   sweep,
   reduce,
   onActivate,
   onHover,
   onHoverEnd,
}: {
   node: RadialNode;
   index: number;
   count: number;
   radius: number;
   sweep: MotionValue<number>;
   reduce: boolean;
   onActivate: () => void;
   onHover: () => void;
   onHoverEnd: () => void;
}) {
   const destructive = !isSubmenu(node) && node.destructive;
   // Position follows the arc as the sweep eases to 0 (translate only, so the icon stays upright).
   const x = useTransform(sweep, (s) => radialOffset(index, count, radius, s).x);
   const y = useTransform(sweep, (s) => radialOffset(index, count, radius, s).y);

   return (
      <motion.button
         type="button"
         title={node.label}
         aria-label={node.label}
         onPointerEnter={onHover}
         onPointerLeave={onHoverEnd}
         onClick={onActivate}
         initial={reduce ? false : { opacity: 0, scale: 0.6 }}
         animate={{ opacity: 1, scale: 1 }}
         transition={reduce ? { duration: 0 } : { delay: index * 0.03, duration: 0.2, ease: 'easeOut' }}
         style={{ left: 0, top: 0, marginLeft: -BUTTON_SIZE / 2, marginTop: -BUTTON_SIZE / 2, width: BUTTON_SIZE, height: BUTTON_SIZE, x, y }}
         className={cn(
            'absolute flex items-center justify-center rounded-full border shadow-md backdrop-blur-sm cursor-pointer',
            destructive
               ? 'border-destructive/50 bg-popover/90 text-destructive hover:bg-destructive/20'
               : 'border-border bg-popover/90 text-popover-foreground hover:bg-muted',
         )}
      >
         {node.icon}
      </motion.button>
   );
}
