// -- React Imports --
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';

// -- Store and Hook Imports --
import { useReferencedDrawerItem } from '@/lib/board/useReferencedDrawerItem';
import { getOrCreateNoteInstance } from '@/lib/notes/noteStoreRegistry';
import { importNote } from '@/lib/notes/noteRepository';
import { useTabManagerActions, useTabManagerStore } from '@/lib/character/tabManagerStore';

// -- Component Imports --
import { NoteDocument } from '@/components/molecules/NoteDocument';

// -- Type Imports --
import type { BoardItem, BoardItemContent, NoteBoardContent, Note } from '@/lib/types/board';

/*
 * A read-only board tile mirroring a saved note (never an editable copy - editing is the note tab's
 * job). A reference resolves, in order: the LIVE open-tab instance (so unsaved edits show); else the
 * saved drawer entry (`sourceDrawerItemId`), with dangling handling; else a "removed without being
 * saved" placeholder. The live-or-saved choice is a clean hooks split - the parent reads only the
 * open-check, then mounts ONE source child. A copy (a later convert-to-copy result) renders its frozen
 * snapshot directly. The tile is the parchment sheet windowed: `NoteDocument` on the `--paper-*`
 * surface with internal vertical scroll; double-click opens the note's tab.
 */

/** Stable serialization for the cache change-check (undefined stays undefined). */
function serialize(value: unknown): string | undefined {
   return value === undefined ? undefined : JSON.stringify(value);
}

/**
 * Opens the referenced note in its tab: focuses it when already open, else materializes the drawer
 * copy into the working note table (linked to its source) and opens it by id - mirrors the drawer->tab
 * open flow. `note` is the aggregate in hand (the live instance or the drawer read) seeding the import.
 */
function openNoteReference(
   noteId: string,
   note: Note,
   sourceDrawerItemId: string | undefined,
   actions: ReturnType<typeof useTabManagerActions>,
): void {
   if (useTabManagerStore.getState().openTabs.some((tab) => tab.id === noteId)) {
      actions.setActiveTab(noteId);
      return;
   }
   void importNote(note, sourceDrawerItemId ?? null).then(() => actions.openNoteTab(noteId));
}

interface BoardNoteItemProps {
   item: BoardItem;
   content: NoteBoardContent;
   /** Caches the reference's last-known read via a direct (non-undoable) write. */
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   onDelete: (id: string) => void;
}

export function BoardNoteItem({ item, content, onCacheLastKnown, onDelete }: BoardNoteItemProps) {
   const { t } = useTranslation();
   // Open in a tab? Show the live instance. Tabs are keyed by the note id, so this needs no drawer read.
   // A copy never resolves live: it carries no `noteId` and reads its own frozen snapshot.
   const isOpen = useTabManagerStore((state) => content.mode === 'reference' && state.openTabs.some((tab) => tab.id === content.noteId));

   if (content.mode === 'copy') {
      // A frozen snapshot (convert-to-copy, a later phase): render `data` directly, no live source.
      return <NoteTile note={content.data} />;
   }
   if (isOpen) {
      return <LiveNoteSource noteId={content.noteId} sourceDrawerItemId={content.sourceDrawerItemId} />;
   }
   if (content.sourceDrawerItemId) {
      return <DrawerNoteSource item={item} content={content} onCacheLastKnown={onCacheLastKnown} onDelete={onDelete} />;
   }
   // Closed AND no source: a note that was never persisted anywhere.
   return <MissingNotePanel message={t('BoardView.referenceUnsavedRemoved')} onDelete={() => onDelete(item.id)} />;
}

/**
 * The live source: subscribes to the open note's store instance, so an edit in its tab updates the tile
 * immediately. Only mounted when the note is open, so the instance already exists.
 */
function LiveNoteSource({ noteId, sourceDrawerItemId }: { noteId: string; sourceDrawerItemId?: string }) {
   const actions = useTabManagerActions();
   const note = useStore(getOrCreateNoteInstance(noteId), (state) => state.note);

   // An open note never dangles. A momentary null (device-flip hydration) shows the quiet panel.
   if (!note) return <LoadingPanel />;

   return <NoteTile note={note} onOpen={() => openNoteReference(noteId, note, sourceDrawerItemId, actions)} />;
}

/**
 * The saved source: the live read-only mirror of the drawer item, used when the note is not open but
 * has a saved source. Caches each read as `lastKnown` so a deleted source degrades to a placeholder.
 */
function DrawerNoteSource({ item, content, onCacheLastKnown, onDelete }: BoardNoteItemProps) {
   const { t } = useTranslation();
   const actions = useTabManagerActions();
   const reference = content.mode === 'reference' ? content : null;
   const { content: liveContent, status } = useReferencedDrawerItem(reference?.sourceDrawerItemId ?? null);

   // Live read while present, else the last cached one (so a dangling tile still has a title).
   const note = (liveContent ?? reference?.lastKnown ?? null) as Note | null;

   // Cache the live read as `lastKnown`, change-gated so a re-read doesn't flood the engine. A direct
   // (non-command) write keeps a passive source edit off the board undo stack.
   useEffect(() => {
      if (!reference) return;
      if (status !== 'live' || liveContent == null) return;
      if (serialize(liveContent) === serialize(reference.lastKnown)) return;
      onCacheLastKnown(item.id, { kind: 'note', mode: 'reference', noteId: reference.noteId, sourceDrawerItemId: reference.sourceDrawerItemId, lastKnown: liveContent as Note });
   }, [reference, status, liveContent, item.id, onCacheLastKnown]);

   // Dangling: the source note was deleted. A placeholder (title from the last read) + remove.
   if (status === 'dangling') {
      const title = (reference?.lastKnown as Note | undefined)?.title;
      return <MissingNotePanel name={title} message={t('BoardView.referenceSourceRemoved')} onDelete={() => onDelete(item.id)} />;
   }

   // Not yet loaded (first read in flight, no cache): a quiet parchment placeholder.
   if (!note || !reference) return <LoadingPanel />;

   return <NoteTile note={note} onOpen={() => openNoteReference(reference.noteId, note, reference.sourceDrawerItemId, actions)} />;
}

/**
 * The parchment tile: the note's Reading render ({@link NoteDocument}) on the `--paper-*` surface,
 * windowed - a bordered sheet with internal vertical scroll. The scroll container is tagged
 * `data-board-wheel-scroll` so the wheel scrolls the tile instead of zooming the canvas. Double-click
 * opens the note's tab (no editor mounts on the canvas). The box supplies the selection ring + grip.
 */
function NoteTile({ note, onOpen }: { note: Note; onOpen?: () => void }) {
   return (
      <div
         onDoubleClick={onOpen}
         className="h-full w-full overflow-hidden rounded-lg border border-paper-border bg-paper-background text-paper-foreground shadow-sm"
      >
         <div data-board-wheel-scroll className="h-full w-full overflow-y-auto overflow-x-hidden px-4 py-3">
            <NoteDocument title={note.title} body={note.body} cover={note.cover} />
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
