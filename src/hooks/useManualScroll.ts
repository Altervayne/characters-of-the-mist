// -- React Imports --
import { useEffect, type RefObject } from 'react';



export const useManualScroll = (ref: RefObject<HTMLElement | null>) => {
   useEffect(() => {
      const element = ref.current;

      const handleWheel = (e: WheelEvent) => {
         if (element) {
            const isScrollable = element.scrollHeight > element.clientHeight;

            if (isScrollable) {
               e.preventDefault();
               element.scrollTop += e.deltaY;
            }
         }
      };

      element?.addEventListener('wheel', handleWheel, { passive: false });

      return () => {
         element?.removeEventListener('wheel', handleWheel);
      };
   }, [ref]);
};