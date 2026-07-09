// -- Other Library Imports --
import { create } from 'zustand';

// -- Notes Data Layer Imports --
import { getNote, linkNoteToDrawerItem, patchNote, saveNoteToLinkedDrawerItem } from '@/lib/notes/noteRepository';
import { recordToNote } from '@/lib/notes/noteRecords';

// -- Store Imports --
import { useAppGeneralStateStore } from './appGeneralStateStore';

// -- Type Imports --
import type { Note, NoteCover } from '@/lib/types/board';
import type { SaveNoteToDrawerResult } from '@/lib/notes/noteRepository';

/*
 * Note store - the React-facing, in-memory view of ONE open Note, backed by the note
 * repository. A Note is a single flat document, so there is no command engine and no undo
 * stack (the editor is a plain textarea, not a spatial canvas): title/body edits apply in
 * memory and debounce-persist onto the note row. It mirrors the per-instance factory shape
 * of the board store (one store per open note), minus the item/command machinery.
 */

/** How long a title/body edit settles before it is written back to the note record. */
const NOTE_SAVE_DEBOUNCE_MS = 400;

export interface NoteState {
   /** The open note's id, or `null` before the first successful hydrate. */
   noteId: string | null;
   /** The live document. */
   note: Note | null;
   /** The linked drawer `NOTE` item, or `null` when this note was never saved. */
   drawerItemId: string | null;
   /** True when the note differs from its saved drawer copy, or was never saved. */
   hasUnsavedChanges: boolean;
   isLoading: boolean;
   error: string | null;
   actions: {
      /** Loads a note into the store from its record. Tolerates a missing note. */
      hydrate: (noteId: string) => Promise<void>;
      /** Seeds the store from an in-hand aggregate (a freshly created note), linking its drawer item if any. */
      loadNote: (note: Note, drawerItemId?: string | null) => void;
      /** Updates the title in memory and debounce-persists it; marks the note dirty. */
      updateTitle: (title: string) => void;
      /** Updates the body in memory and debounce-persists it; marks the note dirty. */
      updateBody: (body: string) => void;
      /** Sets a fresh note-level cover (hash + box width/aspect) in memory and debounce-persists it; marks the note dirty. */
      setCover: (cover: NoteCover) => void;
      /** Patches the current cover's box (width and/or aspect) in memory and debounce-persists it; marks the note dirty. No-op with no cover. */
      updateCover: (patch: Partial<Pick<NoteCover, 'width' | 'aspect'>>) => void;
      /** Clears the note-level cover in memory and debounce-persists it; marks the note dirty. */
      clearCover: () => void;
      /** Sets the unsaved-changes flag directly (e.g. a save site marks the note clean). */
      setHasUnsavedChanges: (value: boolean) => void;
      /**
       * Immediately persists the current document onto its row, bypassing the debounce.
       * The Note tab surface calls this on unmount (a tab switch fires no blur), so the
       * last keystroke is never lost to a cancelled debounce timer.
       */
      flush: () => void;
      /**
       * Saves the note to its LINKED drawer item (if any), flushing the live document.
       * Marks the note clean on success. Returns the outcome, or `null` when no note is
       * loaded; `{ linkedItemUpdated: false }` means the caller should "Save As".
       */
      saveToDrawer: () => Promise<SaveNoteToDrawerResult | null>;
      /**
       * Links the note to a new drawer item id (for "Save As"), flushes the document,
       * marks the note clean, and returns the aggregate to seed that drawer item.
       */
      linkToDrawerItem: (drawerItemId: string) => Promise<Note | null>;
   };
}

const initialState: Pick<NoteState, 'noteId' | 'note' | 'drawerItemId' | 'hasUnsavedChanges' | 'isLoading' | 'error'> = {
   noteId: null,
   note: null,
   drawerItemId: null,
   hasUnsavedChanges: false,
   isLoading: false,
   error: null,
};

/** Normalizes a thrown value into the store's `error` message string. */
function toErrorMessage(error: unknown): string {
   return error instanceof Error ? error.message : String(error);
}

/** Marks the note store as the most recently modified, so Ctrl/Cmd+Z routing skips the drawer. */
function markNoteModified(): void {
   useAppGeneralStateStore.getState().actions.setLastModifiedStore('note');
}

/** A trailing-edge debouncer; at most one timer in flight. No new dependency. */
function createDebouncer<T>(delay: number, run: (value: T) => void): (value: T) => void {
   let timer: ReturnType<typeof setTimeout> | null = null;
   return (value: T) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
         timer = null;
         run(value);
      }, delay);
   };
}

/**
 * Builds a note store instance: the in-memory document plus the action API. Each open
 * note tab owns its own instance (like a board), so two notes never share mutable state.
 * The `saveDebounceMs` option exists for tests; production uses the default.
 */
export function createNoteStore(options: { saveDebounceMs?: number } = {}) {
   const saveDebounceMs = options.saveDebounceMs ?? NOTE_SAVE_DEBOUNCE_MS;

   const useStore = create<NoteState>()((set, get) => {
      /** Persists the current document onto its row. Best-effort; a missing row is a no-op. */
      const debouncedSave = createDebouncer<Note>(saveDebounceMs, (note) => {
         void patchNote(note.id, { title: note.title, body: note.body, cover: note.cover }).catch((error) => {
            console.error('Note save failed:', error);
         });
      });

      /** Marks a real edit: routes Ctrl/Cmd+Z here AND flags the note dirty (so close warns). */
      const markDirty = (): void => {
         markNoteModified();
         set({ hasUnsavedChanges: true });
      };

      return {
         ...initialState,
         actions: {
            hydrate: async (noteId) => {
               set({ isLoading: true, error: null });
               try {
                  const record = await getNote(noteId);
                  if (!record) {
                     set({ ...initialState, error: `Note not found: ${noteId}` });
                     return;
                  }
                  // Opened from its record: it matches its saved copy (if any), so it starts
                  // clean. The first edit dirties it.
                  set({ noteId, note: recordToNote(record), drawerItemId: record.drawerItemId ?? null, hasUnsavedChanges: false, isLoading: false, error: null });
               } catch (error) {
                  set({ isLoading: false, error: toErrorMessage(error) });
               }
            },

            loadNote: (note, drawerItemId) => {
               // Seeded from an in-hand aggregate: it matches its persisted row, so it starts clean.
               set({ noteId: note.id, note, drawerItemId: drawerItemId ?? null, hasUnsavedChanges: false, isLoading: false, error: null });
            },

            updateTitle: (title) => {
               const note = get().note;
               if (!note) return;
               const next = { ...note, title };
               markDirty();
               set({ note: next });
               debouncedSave(next);
            },

            updateBody: (body) => {
               const note = get().note;
               if (!note) return;
               const next = { ...note, body };
               markDirty();
               set({ note: next });
               debouncedSave(next);
            },

            setCover: (cover) => {
               const note = get().note;
               if (!note) return;
               const next = { ...note, cover };
               markDirty();
               set({ note: next });
               debouncedSave(next);
            },

            updateCover: (patch) => {
               const note = get().note;
               if (!note || !note.cover) return;
               const next = { ...note, cover: { ...note.cover, ...patch } };
               markDirty();
               set({ note: next });
               debouncedSave(next);
            },

            clearCover: () => {
               const note = get().note;
               if (!note || !note.cover) return;
               const next = { ...note, cover: undefined };
               markDirty();
               set({ note: next });
               debouncedSave(next);
            },

            setHasUnsavedChanges: (value) => {
               set({ hasUnsavedChanges: value });
            },

            flush: () => {
               const note = get().note;
               if (!note) return;
               void patchNote(note.id, { title: note.title, body: note.body, cover: note.cover }).catch((error) => {
                  console.error('Note flush failed:', error);
               });
            },

            saveToDrawer: async () => {
               const note = get().note;
               if (!note) return null;
               const result = await saveNoteToLinkedDrawerItem(note);
               if (result.linkedItemUpdated) set({ hasUnsavedChanges: false });
               return result;
            },

            linkToDrawerItem: async (drawerItemId) => {
               const note = get().note;
               if (!note) return null;
               const aggregate = await linkNoteToDrawerItem(note, drawerItemId);
               set({ drawerItemId, hasUnsavedChanges: false });
               return aggregate;
            },
         },
      };
   });

   return useStore;
}

/** A single note store instance: the in-memory document + actions. */
export type NoteStore = ReturnType<typeof createNoteStore>;
