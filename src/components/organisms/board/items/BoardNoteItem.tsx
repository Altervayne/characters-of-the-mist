// -- React Imports --
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';

// -- Icon Imports --
import { Link2, Pencil, Unlink, X } from 'lucide-react';

// -- Store and Hook Imports --
import { useReferencedDrawerItem } from '@/lib/board/useReferencedDrawerItem';
import { detachNoteToCopy, materializeCopyAsReference } from '@/lib/board/referenceContent';
import { getOrCreateNoteInstance } from '@/lib/notes/noteStoreRegistry';
import { openNoteReference } from '@/lib/notes/openNoteReference';
import { useTabManagerActions, useTabManagerStore } from '@/lib/character/tabManagerStore';

// -- Component Imports --
import { NoteDocument } from '@/components/molecules/NoteDocument';

// -- Type Imports --
import type { BoardItem, BoardItemContent, NoteBoardContent, Note } from '@/lib/types/board';

/** The live-mirror (reference) half of {@link NoteBoardContent}; the resolving sources hold only this variant. */
type NoteReferenceContent = Extract<NoteBoardContent, { mode: 'reference' }>;
/** The frozen-snapshot (copy) half of {@link NoteBoardContent}. */
type NoteCopyContent = Extract<NoteBoardContent, { mode: 'copy' }>;

/*
 * A board tile for a note. A REFERENCE is the read-only live mirror (editing is the note tab's job): it
 * resolves the LIVE open-tab instance (so unsaved edits show) when open; else - closed - a DRAWER-BACKED
 * reference reads its saved drawer entry (`sourceDrawerItemId`), degrading to rich dangling when that source
 * is gone. A reference is only ever "linked" to a reachable source: an open tab or a saved drawer note - a
 * drawer-LESS note re-freezes to a copy when its tab closes (see `refreezeNoteReferences`), so it never
 * lingers as a closed reference. A COPY is a frozen snapshot that renders `content.data` statically - but it
 * is NOT terminal: opening it (pencil / double-click) ADOPTS it, materializing `data` into a real note + open
 * tab and re-homing the tile as a live reference (`adopt-on-open`), so a copy becomes editable + mirrored +
 * saveable again. A selected live reference can Convert to copy to re-freeze it. The tile is the parchment
 * sheet windowed: `NoteDocument` (compact) on the `--paper-*` surface with internal vertical scroll.
 */

/** Stable serialization for the cache change-check (undefined stays undefined). */
function serialize(value: unknown): string | undefined {
   return value === undefined ? undefined : JSON.stringify(value);
}

/**
 * Adopt-on-open for a copy: materializes the frozen `data` into a fresh standalone note (new id), writes it
 * to the working table, OPENS its tab, then re-homes the board tile as a live reference to it (undoable
 * command). The materialized note has NO drawer parent yet; a later Save links one. Opening the tab BEFORE
 * the re-link means the board (which the open-tab switch unmounts) only ever re-renders the tile once the
 * note is already open, so it resolves straight to the live instance - no closed-reference/dangling flash.
 */
function adoptCopyOnOpen(
   content: NoteCopyContent,
   onContentChange: (content: BoardItemContent) => void,
   actions: ReturnType<typeof useTabManagerActions>,
): void {
   const { note, content: reference } = materializeCopyAsReference(content.data);
   void (async () => {
      await importNote(note, null);
      await actions.openNoteTab(note.id);
      onContentChange(reference);
   })();
}

interface BoardNoteItemProps {
   item: BoardItem;
   content: NoteBoardContent;
   /** In the selection set: gates the toolbar Edit-pencil + Convert-to-copy portal. */
   isSelected: boolean;
   /** The selection toolbar's per-kind action slot; the Edit-pencil + Convert-to-copy portal here. Null when unselected. */
   toolbarSlot: HTMLElement | null;
   /** Commits a content change as an undoable board command (Convert-to-copy + adopt-on-open use this). */
   onContentChange: (content: BoardItemContent) => void;
   /** Caches the reference's last-known read / picked-up drawer link via a direct (non-undoable) write. */
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   onDelete: (id: string) => void;
}

export function BoardNoteItem({ item, content, isSelected, toolbarSlot, onContentChange, onCacheLastKnown, onDelete }: BoardNoteItemProps) {
   // Open in a tab? Show the live instance. Tabs are keyed by the note id, so this needs no read.
   // A copy never resolves live: it carries no `noteId` and reads its own frozen snapshot.
   const isOpen = useTabManagerStore((state) => content.mode === 'reference' && state.openTabs.some((tab) => tab.id === content.noteId));

   if (content.mode === 'copy') {
      // A frozen snapshot: renders `data` statically, but opening ADOPTS it into an editable, mirrored note.
      return <CopyNoteSource content={content} isSelected={isSelected} toolbarSlot={toolbarSlot} onContentChange={onContentChange} />;
   }
   if (isOpen) {
      return <LiveNoteSource content={content} isSelected={isSelected} toolbarSlot={toolbarSlot} onContentChange={onContentChange} />;
   }
   return <ClosedNoteSource item={item} content={content} isSelected={isSelected} toolbarSlot={toolbarSlot} onContentChange={onContentChange} onCacheLastKnown={onCacheLastKnown} onDelete={onDelete} />;
}

/**
 * A frozen copy: renders its snapshot statically (no live source, no convert), but the Edit-pencil /
 * double-click ADOPT it - materializing the snapshot into a real editable note and re-homing this tile onto
 * it as a live reference. So a copy is a resting view, not a dead end.
 */
function CopyNoteSource({ content, isSelected, toolbarSlot, onContentChange }: { content: NoteCopyContent; isSelected: boolean; toolbarSlot: HTMLElement | null; onContentChange: (content: BoardItemContent) => void }) {
   const actions = useTabManagerActions();
   return (
      <NoteTile
         note={content.data}
         isSelected={isSelected}
         toolbarSlot={toolbarSlot}
         onOpen={() => adoptCopyOnOpen(content, onContentChange, actions)}
      />
   );
}

interface ReferenceSourceProps {
   item: BoardItem;
   content: NoteReferenceContent;
   isSelected: boolean;
   toolbarSlot: HTMLElement | null;
   onContentChange: (content: BoardItemContent) => void;
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   onDelete: (id: string) => void;
}

/**
 * The live source: subscribes to the open note's store instance, so an edit in its tab updates the tile
 * immediately. The note's drawer link (once it is Saved) is stamped onto the reference by the Save path
 * itself ({@link stampNoteReferencesDrawerSource}), not here - the Save is fired from the note tab, where
 * the board (and this component) is unmounted, so it can't ride a render effect.
 */
function LiveNoteSource({ content, isSelected, toolbarSlot, onContentChange }: Pick<ReferenceSourceProps, 'content' | 'isSelected' | 'toolbarSlot' | 'onContentChange'>) {
   const actions = useTabManagerActions();
   const note = useStore(getOrCreateNoteInstance(content.noteId), (state) => state.note);

   // An open note never dangles. A momentary null (device-flip hydration) shows the quiet panel.
   if (!note) return <LoadingPanel />;

   return (
      <NoteTile
         note={note}
         isSelected={isSelected}
         toolbarSlot={toolbarSlot}
         onOpen={() => openNoteReference(content.noteId, note, content.sourceDrawerItemId, actions)}
         onConvertToCopy={() => onContentChange(detachNoteToCopy(content, note))}
      />
   );
}

/**
 * The closed source: the note's tab isn't open, so resolve it read-only from its saved DRAWER item
 * (`sourceDrawerItemId`), caching that read as `lastKnown` for dangling. This is a DRAWER-BACKED reference: a
 * drawer-dropped note, or an adopted note after it was Saved (the Save pickup stamped the source id). A
 * drawer-LESS reference never reaches here closed - closing its tab re-freezes it to a copy - so there is no
 * working-row read. When the drawer source is gone, degrade to the rich dangling tile (last-known + salvage).
 */
function ClosedNoteSource({ item, content, isSelected, toolbarSlot, onContentChange, onCacheLastKnown, onDelete }: ReferenceSourceProps) {
   const { t } = useTranslation();
   const actions = useTabManagerActions();

   const { content: liveContent, status } = useReferencedDrawerItem(content.sourceDrawerItemId ?? null);

   // Cache the live drawer read as `lastKnown`, change-gated so a re-read doesn't flood the engine.
   useEffect(() => {
      if (status !== 'live' || liveContent == null) return;
      if (serialize(liveContent) === serialize(content.lastKnown)) return;
      onCacheLastKnown(item.id, { ...content, lastKnown: liveContent as Note });
   }, [status, liveContent, content, item.id, onCacheLastKnown]);

   const note = status === 'live' ? (liveContent as Note) : (content.lastKnown ?? null);

   // The drawer source is gone (or was never set): rich dangling if we cached a last-known, else the bare
   // removed panel. Never a crash.
   if (status === 'dangling' || !note) {
      if (content.lastKnown) {
         return <DanglingNoteTile note={content.lastKnown} onConvertToCopy={() => onContentChange(detachNoteToCopy(content, null))} onDelete={() => onDelete(item.id)} />;
      }
      return <MissingNotePanel message={t('BoardView.referenceSourceRemoved')} onDelete={() => onDelete(item.id)} />;
   }

   return (
      <NoteTile
         note={note}
         isSelected={isSelected}
         toolbarSlot={toolbarSlot}
         onOpen={() => openNoteReference(content.noteId, note, content.sourceDrawerItemId, actions)}
         onConvertToCopy={() => onContentChange(detachNoteToCopy(content, note))}
      />
   );
}

/**
 * The parchment tile: the note's Reading render ({@link NoteDocument}, `compact` so its title + cover size
 * with the tile) on the `--paper-*` surface, windowed - a bordered sheet with internal vertical scroll. The
 * scroll container is tagged `data-board-wheel-scroll` so the wheel scrolls the tile instead of zooming the
 * canvas. `onOpen` opens/adopts the note (pencil + double-click) - a reference focuses its tab, a copy adopts
 * into one. `onConvertToCopy` (references only) freezes it. The linked badge marks a live reference; a copy
 * (no convert) shows none, so a frozen copy still reads distinct from a live handout. The box supplies the
 * selection ring + grip.
 */
function NoteTile({ note, onOpen, onConvertToCopy, isSelected, toolbarSlot }: { note: Note; onOpen?: () => void; onConvertToCopy?: () => void; isSelected: boolean; toolbarSlot: HTMLElement | null }) {
   const { t } = useTranslation();
   // A live reference exposes convert-to-copy; a frozen copy does not - so the same flag drives the badge.
   const isReference = !!onConvertToCopy;
   return (
      <div
         onDoubleClick={onOpen}
         className="relative h-full w-full overflow-hidden rounded-lg border border-paper-border bg-paper-background text-paper-foreground shadow-sm"
      >
         <div data-board-wheel-scroll className="h-full w-full overflow-y-auto overflow-x-hidden px-4 py-3">
            <NoteDocument compact title={note.title} body={note.body} cover={note.cover} />
         </div>
         {/* Linked badge (app-theme chrome): marks a live reference so it reads distinct from a frozen copy. */}
         {isReference && (
            <span
               className="absolute right-1.5 top-1.5 flex items-center justify-center rounded bg-primary/90 p-0.5 text-primary-foreground shadow-sm"
               title={t('BoardView.linkedBadge')}
               aria-label={t('BoardView.linkedBadge')}
            >
               <Link2 className="h-3 w-3" />
            </span>
         )}
         {/* Per-kind toolbar actions (selected only): open the note tab (the twin of double-click), and - for a
             reference - Convert to copy, freezing the current content into a self-contained snapshot. */}
         {isSelected && toolbarSlot && createPortal(
            <>
               {onOpen && (
                  <button
                     type="button"
                     title={t('BoardView.editNote')}
                     aria-label={t('BoardView.editNote')}
                     onPointerDown={(event) => event.stopPropagation()}
                     onClick={onOpen}
                     className="flex cursor-pointer items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                     <Pencil className="h-4 w-4" />
                  </button>
               )}
               {onConvertToCopy && (
                  <button
                     type="button"
                     title={t('BoardView.convertToCopy')}
                     aria-label={t('BoardView.convertToCopy')}
                     onPointerDown={(event) => event.stopPropagation()}
                     onClick={onConvertToCopy}
                     className="flex cursor-pointer items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                     <Unlink className="h-4 w-4" />
                  </button>
               )}
            </>,
            toolbarSlot,
         )}
      </div>
   );
}

/**
 * The dangling tile: the source note was deleted, so its last-known content is shown (dimmed) beneath a
 * salvage banner - Convert to copy freezes what remains into a self-contained snapshot, or remove it. The
 * banner is always visible (not selection-gated) so a dangling reference can be rescued directly. Chrome is
 * app-theme (the deleted-source state), the content stays paper. Mirrors the character/card dangling flow.
 */
function DanglingNoteTile({ note, onConvertToCopy, onDelete }: { note: Note; onConvertToCopy: () => void; onDelete: () => void }) {
   const { t } = useTranslation();
   return (
      <div className="relative h-full w-full overflow-hidden rounded-lg border border-paper-border bg-paper-background text-paper-foreground shadow-sm">
         <div data-board-wheel-scroll className="h-full w-full overflow-y-auto overflow-x-hidden px-4 pb-3 pt-9 opacity-50">
            <NoteDocument compact title={note.title} body={note.body} cover={note.cover} />
         </div>
         <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-destructive/90 px-2 py-1 text-destructive-foreground shadow-sm">
            <span className="min-w-0 flex-1 truncate text-xs font-medium">{t('BoardView.referenceSourceRemoved')}</span>
            <button
               type="button"
               title={t('BoardView.convertToCopy')}
               onPointerDown={(event) => event.stopPropagation()}
               onClick={onConvertToCopy}
               className="shrink-0 cursor-pointer rounded bg-background/90 px-1.5 py-0.5 text-[0.65rem] font-medium text-foreground hover:bg-background"
            >
               {t('BoardView.convertToCopy')}
            </button>
            <button
               type="button"
               title={t('BoardView.deleteItem')}
               aria-label={t('BoardView.deleteItem')}
               onPointerDown={(event) => event.stopPropagation()}
               onClick={onDelete}
               className="shrink-0 cursor-pointer rounded p-0.5 hover:bg-background/30"
            >
               <X className="h-3.5 w-3.5" />
            </button>
         </div>
      </div>
   );
}

/** A quiet parchment placeholder shown while the source note is not yet resolved. */
function LoadingPanel() {
   return <div className="h-full w-full rounded-lg border border-paper-border bg-paper-background shadow-sm" />;
}

/**
 * The placeholder for a note the tile can no longer show: a deleted drawer source (with the last-known
 * title) or a note that was never saved. App-themed (no parchment to mislead as a live handout) + a
 * remove button. Mirrors the character element's missing panel.
 */
function MissingNotePanel({ name, message, onDelete }: { name?: string; message: string; onDelete: () => void }) {
   const { t } = useTranslation();
   return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-border bg-popover/95 p-3 text-center shadow-lg backdrop-blur-sm">
         <span className="text-sm font-medium text-foreground">{name || message}</span>
         {name && <span className="text-xs text-muted-foreground">{message}</span>}
         <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onDelete}
            className="cursor-pointer rounded bg-destructive px-2 py-0.5 text-xs text-destructive-foreground hover:bg-destructive/90"
         >
            {t('BoardView.deleteItem')}
         </button>
      </div>
   );
}
