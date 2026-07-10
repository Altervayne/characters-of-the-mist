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
import { useEmbedCharacterStore, getReadonlyEmbedStore, embedGame, readEmbedItem, type EmbedSlot } from '@/lib/board/useEmbedCharacterStore';
import { ActiveCharacterStoreContext } from '@/lib/character/ActiveCharacterStoreContext';

/*
 * The interactive body of a board embed COPY. A SELECTED embed hosts its own per-embed character store
 * (see {@link useEmbedCharacterStore}) so its normal edit logic runs, committing edits back to the board
 * copy's `content.data`. An UNSELECTED embed renders the SAME card/tracker READ-ONLY - identical look (data
 * from the prop) - under a shared, game-keyed read-only store, so NO per-embed store is spun up until it is
 * selected. Board single-selection => at most ~1 live embed store instead of one per copy. The body is
 * select-gated like the post-it textarea: inert when unselected (a click selects, the wheel zooms the
 * board), fully interactive when selected (clicks edit, internal scroll never reaches the canvas zoom).
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
   /** Renders the live item as its real component, in board-embed mode, given the ephemeral edit state. */
   render: (liveData: unknown, isEditing: boolean) => ReactNode;
   /**
    * Extra per-kind toolbar actions (e.g. a card's Flip / Expand), rendered in the toolbar slot beside
    * Edit. Rendered inside the host provider, so the buttons can drive the local store via
    * `useCharacterActions` (e.g. toggling the card's persisted display mode).
    */
   renderToolbarExtras?: (liveData: unknown) => ReactNode;
}

export function InteractiveEmbed(props: InteractiveEmbedProps) {
   // Unselected: render read-only with NO per-embed store - the same board-embed component under a shared,
   // game-keyed read-only host (data rides the prop). Selecting mounts the live store below.
   if (!props.isSelected) {
      return (
         <ActiveCharacterStoreContext.Provider value={getReadonlyEmbedStore(embedGame(props.data))}>
            {/* Matches the live body's unselected wrapper: inert, so a click selects and the wheel zooms. */}
            <div className="pointer-events-none flex h-full w-full items-center justify-center overflow-auto">
               {props.data != null ? props.render(props.data, false) : null}
            </div>
         </ActiveCharacterStoreContext.Provider>
      );
   }
   return <LiveInteractiveEmbed {...props} />;
}

/** The live, editable body: a SELECTED embed's own per-embed store + the Edit toggle. Mounts only while selected. */
function LiveInteractiveEmbed({ slot, data, isSelected, toolbarSlot, onCommit, render, renderToolbarExtras }: InteractiveEmbedProps) {
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
            {liveData != null ? render(liveData, isEditing) : null}
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
               {renderToolbarExtras?.(liveData)}
            </>,
            toolbarSlot,
         )}
      </ActiveCharacterStoreContext.Provider>
   );
}
