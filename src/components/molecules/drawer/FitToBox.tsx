// -- React Imports --
import { useEffect, useRef, useState, type ReactNode } from 'react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

/*
 * Fits arbitrary content into a fixed box by measuring its intrinsic size and `transform: scale`-ing it
 * to fit, centered (letterboxed). The drawer's per-type previews have wildly different natural sizes (a
 * tall theme card vs a wide board mini-map); this is what makes every item card the SAME footprint -
 * the previews themselves are reused unchanged, only their containment is uniform.
 */

export function FitToBox({ children, className }: { children: ReactNode; className?: string }) {
   const boxRef = useRef<HTMLDivElement>(null);
   const contentRef = useRef<HTMLDivElement>(null);
   const [scale, setScale] = useState(1);

   useEffect(() => {
      const box = boxRef.current;
      const content = contentRef.current;
      if (!box || !content) return;
      // The observer fires on observe(), so the first measure runs without a synchronous setState in
      // the effect body. Both the box (its width tracks the cell) and the content are watched.
      const measure = () => {
         const boxWidth = box.clientWidth;
         const boxHeight = box.clientHeight;
         const contentWidth = content.offsetWidth;
         const contentHeight = content.offsetHeight;
         if (boxWidth && boxHeight && contentWidth && contentHeight) {
            setScale(Math.min(boxWidth / contentWidth, boxHeight / contentHeight));
         }
      };
      const observer = new ResizeObserver(measure);
      observer.observe(box);
      observer.observe(content);
      return () => observer.disconnect();
   }, []);

   return (
      <div ref={boxRef} className={cn('relative flex items-center justify-center overflow-hidden', className)}>
         <div ref={contentRef} className="shrink-0" style={{ transform: `scale(${scale})` }}>
            {children}
         </div>
      </div>
   );
}
