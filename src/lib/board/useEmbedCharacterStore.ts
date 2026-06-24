// -- React Imports --
import { useEffect, useRef, useState } from 'react';

// -- Other Library Imports --
import cuid from 'cuid';

// -- Store Imports --
import { createCharacterStore, type CharacterStore } from '@/lib/stores/characterStore';

// -- Type Imports --
import type { Character, Card } from '@/lib/types/character';
import type { GameSystem } from '@/lib/types/drawer';

/*
 * The host that makes a board embed editable by reusing the character-store-coupled card/tracker
 * components unchanged. Each embed gets its own tiny character store seeded with a synthetic
 * character holding just this one item (a tracker in the matching `trackers.*` slot, or a card in
 * `cards`). The component, rendered under this store via ActiveCharacterStoreContext, edits the
 * synthetic character through its normal `useCharacterActions()`; we sync the single item back to
 * the board copy's `content.data` (one undoable board command), and re-seed when `content.data`
 * changes externally (undo/redo, reload). Both directions are serialize-guarded so a commit can't
 * bounce back into a re-seed that re-commits. The board owns undo, so the local zundo is paused.
 */

/** Which slot of the synthetic character the embed's single item lives in. */
export type EmbedSlot = 'statuses' | 'storyTags' | 'storyThemes' | 'cards';

/** Stable serialization for the loop-guard compare (mirrors the reference-cache pattern). */
function serialize(value: unknown): string {
   return JSON.stringify(value ?? null);
}

/**
 * The game the synthetic host character is seeded with: a card carries its own (`details.game`),
 * but a tracker is game-agnostic, so it seeds NEUTRAL - which themes a board tracker by the app
 * tokens, not a game accent.
 */
function embedGame(data: unknown): GameSystem {
   const d = data as { details?: { game?: GameSystem } };
   return d.details?.game ?? 'NEUTRAL';
}

/** A synthetic character holding only this embed's item in the right slot (everything else empty). */
export function seedCharacter(slot: EmbedSlot, data: unknown): Character {
   const base: Character = {
      id: cuid(),
      name: 'Embed',
      game: embedGame(data),
      cards: [],
      trackers: { statuses: [], storyTags: [], storyThemes: [] },
   };
   if (slot === 'cards') return { ...base, cards: [data as Card] };
   return { ...base, trackers: { ...base.trackers, [slot]: [data] } };
}

/** The single embed item back out of the synthetic character. */
export function readEmbedItem(slot: EmbedSlot, character: Character | null): unknown {
   if (!character) return undefined;
   return slot === 'cards' ? character.cards[0] : character.trackers[slot][0];
}

/** The two-way sync handle a host store carries. */
export interface EmbedSync {
   /** Re-seed the store from external `content.data` (skipped when it equals the last synced value). */
   reseed: (data: unknown) => void;
   /** Tear down the store subscription. */
   dispose: () => void;
}

/**
 * Wires a character `store` to a board commit, both directions loop-guarded. Pure (no React), so the
 * sync is unit-testable: it seeds the store from `initialData`, calls `onCommit` when the single
 * item changes (a real edit), and exposes `reseed` for external `content.data` changes. The guard
 * key is the last value synced either way, so a commit that writes `content.data` back never bounces
 * into a re-seed, and a re-seed never bounces into a commit.
 */
export function createEmbedSync(store: CharacterStore, slot: EmbedSlot, initialData: unknown, onCommit: (next: unknown) => void): EmbedSync {
   let lastSynced = serialize(initialData);
   store.setState({ character: seedCharacter(slot, initialData) });
   const unsubscribe = store.subscribe((state) => {
      const next = readEmbedItem(slot, state.character);
      const s = serialize(next);
      if (s === lastSynced) return; // our own re-seed echo, or a no-op change
      lastSynced = s;
      onCommit(next);
   });
   return {
      reseed: (data) => {
         const incoming = serialize(data);
         if (incoming === lastSynced) return; // our own commit bouncing back
         lastSynced = incoming;
         store.setState({ character: seedCharacter(slot, data) });
      },
      dispose: unsubscribe,
   };
}

interface UseEmbedCharacterStoreArgs {
   slot: EmbedSlot;
   /** The board copy's current `content.data` (the tracker/card). */
   data: unknown;
   /** Commits the edited item back to the board (the caller wraps it as one undoable `updateItemContent`). */
   onCommit: (next: unknown) => void;
}

/**
 * Returns a stable per-embed character store seeded from `data`, wired to commit edits back via
 * `onCommit` and to re-seed when `data` changes externally. Render the card/tracker beneath it via
 * `ActiveCharacterStoreContext.Provider`.
 *
 * One store per mount: a re-id'd / duplicated embed is a different board item id, and board items are
 * keyed by id, so it remounts and gets its own fresh store. The board owns undo, so the local zundo
 * is paused; the store is seeded in the lazy initializer so the first render already has the item.
 */
export function useEmbedCharacterStore({ slot, data, onCommit }: UseEmbedCharacterStoreArgs): CharacterStore {
   const onCommitRef = useRef(onCommit);
   useEffect(() => { onCommitRef.current = onCommit; });

   const [store] = useState<CharacterStore>(() => {
      const created = createCharacterStore();
      created.temporal.getState().pause();
      created.setState({ character: seedCharacter(slot, data) });
      return created;
   });
   // The data as of mount, so the sync's initial seed/guard matches what the lazy init seeded.
   const [initialData] = useState(data);

   // The sync (subscription + guard) lives across renders; set up once per store/slot.
   const syncRef = useRef<EmbedSync | null>(null);
   useEffect(() => {
      const sync = createEmbedSync(store, slot, initialData, (next) => onCommitRef.current(next));
      syncRef.current = sync;
      return () => { sync.dispose(); syncRef.current = null; };
   }, [store, slot, initialData]);

   // Re-seed on an external `content.data` change (undo/redo, reload); the guard no-ops our own echo.
   useEffect(() => { syncRef.current?.reseed(data); }, [data]);

   return store;
}
