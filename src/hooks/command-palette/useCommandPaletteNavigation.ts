// -- React Imports --
import { useEffect, useState } from 'react';

/**
 * Manages the command palette's page navigation stack.
 *
 * The palette is modelled as a stack of page ids; the last entry is the
 * active page. Pushing advances into a sub-page (such as a wizard step),
 * popping returns to the previous one, and the stack resets to the root
 * whenever the palette closes.
 *
 * @param isOpen - Whether the command palette is currently open. When this
 *   transitions to false the stack is reset back to ['root'].
 * @returns The page stack, the derived active page, and the stack mutators
 *   (pushPage, popPage, resetPages).
 */
export function useCommandPaletteNavigation(isOpen: boolean) {
   const [pages, setPages] = useState<string[]>(['root']);
   const activePage = pages[pages.length - 1];

   const pushPage = (pageId: string) => {
      setPages((previousPages) => [...previousPages, pageId]);
   };

   const popPage = () => {
      setPages((previousPages) => previousPages.slice(0, -1));
   };

   const resetPages = () => {
      setPages(['root']);
   };

   // Reset the page stack to the root whenever the palette closes.
   useEffect(() => {
      if (!isOpen) {
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setPages(['root']);
      }
   }, [isOpen]);

   return { pages, activePage, pushPage, popPage, resetPages };
}
