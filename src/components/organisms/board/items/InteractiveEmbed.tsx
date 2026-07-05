// -- React Imports --
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';

// -- Icon Imports --
import { Pencil } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Board / Character Imports --
import { useEmbedCharacterStore, readEmbedItem, type EmbedSlot } from '@/lib/board/useEmbedCharacterStore';
import { ActiveCharacterStoreContext } from '@/lib/character/ActiveCharacterStoreContext';

/*
 * The interactive body of a board embed COPY: it hosts a per-embed character store (see
 * {@link useEmbedCharacterStore}), provides it via ActiveCharacterStoreContext, and renders the
 * real card/tracker beneath it so its normal edit logic runs. Edits commit back to the board copy's
 * `content.data`. The body is select-gated like the post-it textarea: inert when unselected (a click
 * selects, the wheel zooms the board), fully interactive when selected (clicks edit, internal scroll
 * works and never reaches the canvas zoom). The board's Edit toggle drives an ephemeral edit mode.
 */

interface InteractiveEmbedProps {
   slot: EmbedSlot;
   /** The board copy's current `content.data`. */
   data: unknown;
   isSelected: boolean;
   /** The selection toolbar's per-kind slot; the Edit toggle portals here. */
   toolbarSlot: HTMLElement | null;
   /** Commits an edited item back to the board copy (one undoable command). */
   onCommit: (next: unknown) => void;
   /**
    * Whether this embed's expanded overlay is open (board-view state, ephemeral). The overlay renders
    * from the SAME store instance this host provides, so the card gets it via `render` - never a second
    * `useEmbedCharacterStore`. Only the challenge card uses it; other kinds ignore it.
    */
   isExpanded?: boolean;
   /** Requests the expanded overlay open/close (routes to the board-view `expandedItemId`). */
   onExpandedChange?: (expanded: boolean) => void;
   /** Renders the live item as its real component, in board-embed mode, given the ephemeral edit + expanded state. */
   render: (liveData: unknown, isEditing: boolean, isExpanded: boolean) => ReactNode;
   /**
    * Extra per-kind toolbar actions (e.g. a card's Flip / Expand), rendered in the toolbar slot beside
    * Edit. Rendered inside the host provider, so the buttons can drive the local store via
    * `useCharacterActions` and toggle the expanded overlay.
    */
   renderToolbarExtras?: (liveData: unknown, expand: { isExpanded: boolean; onExpandedChange: (expanded: boolean) => void }) => ReactNode;
}

export function InteractiveEmbed({ slot, data, isSelected, toolbarSlot, onCommit, isExpanded = false, onExpandedChange, render, renderToolbarExtras }: InteractiveEmbedProps) {
   const { t } = useTranslation();
   const store = useEmbedCharacterStore({ slot, data, onCommit });
   // The live item from the host store, so the component re-renders on every edit.
   const liveData = useStore(store, (state) => readEmbedItem(slot, state.character));

   // Ephemeral edit mode (the board's pencil toggle); not persisted, resets on deselect.
   const [isEditing, setIsEditing] = useState(false);
   // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the ephemeral edit mode once deselected
   useEffect(() => { if (!isSelected) setIsEditing(false); }, [isSelected]);

   // A selected embed scrolls its own content; stop the wheel before it reaches the canvas zoom
   // listener (an ancestor, bubble phase). No preventDefault, so the inner scroll still happens.
   // Unselected: let the wheel bubble through to the canvas.
   const wrapperRef = useRef<HTMLDivElement>(null);
   const selectedRef = useRef(isSelected);
   useEffect(() => { selectedRef.current = isSelected; }, [isSelected]);
   useEffect(() => {
      const el = wrapperRef.current;
      if (!el) return;
      const onWheel = (event: WheelEvent) => { if (selectedRef.current) event.stopPropagation(); };
      el.addEventListener('wheel', onWheel);
      return () => el.removeEventListener('wheel', onWheel);
   }, []);

   return (
      <ActiveCharacterStoreContext.Provider value={store}>
         <div
            ref={wrapperRef}
            // Selected: stop the pointer here so editing never bubbles into a canvas move; the
            // child controls still receive it. Unselected: pe-none lets a click reach the box (select).
            onPointerDown={(event) => { if (isSelected) event.stopPropagation(); }}
            // No background here: the card/tracker carries its own, so the embed reads as a bare item.
            className={cn(
               'flex h-full w-full items-center justify-center overflow-auto',
               isSelected ? 'pointer-events-auto' : 'pointer-events-none',
            )}
         >
            {liveData != null ? render(liveData, isEditing, isExpanded) : null}
         </div>

         {isSelected && toolbarSlot && createPortal(
            <>
               <button
                  type="button"
                  title={t('BoardView.editEmbed')}
                  aria-label={t('BoardView.editEmbed')}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setIsEditing((value) => !value)}
                  className={cn(
                     'flex cursor-pointer items-center justify-center rounded p-1',
                     isEditing ? 'bg-muted text-primary' : 'text-popover-foreground hover:bg-muted',
                  )}
               >
                  <Pencil className="h-4 w-4" />
               </button>
               {renderToolbarExtras?.(liveData, { isExpanded, onExpandedChange: (value) => onExpandedChange?.(value) })}
            </>,
            toolbarSlot,
         )}
      </ActiveCharacterStoreContext.Provider>
   );
}
