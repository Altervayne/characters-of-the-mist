// -- React Imports --
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';

// -- Store and Hook Imports --
import { useReferencedDrawerItem } from '@/lib/board/useReferencedDrawerItem';
import { getOrCreateInstance } from '@/lib/character/characterStoreRegistry';
import { useTabManagerActions, useTabManagerStore } from '@/lib/character/tabManagerStore';

// -- Component Imports --
import { CharacterBoardOverview } from './CharacterBoardOverview';

// -- Type Imports --
import type { BoardItem, BoardItemContent, CharacterBoardContent } from '@/lib/types/board';
import type { Character } from '@/lib/types/character';

/*
 * A read-only board element mirroring a saved character (never a copy - editing is the character tab's
 * job). It shows the LIVE open-tab instance when the character is open (so unsaved edits show), else
 * the saved drawer entry. Both feed the same {@link CharacterBoardOverview} and navigate to the tab.
 *
 * The live-or-saved choice is a clean hooks split: the parent reads only the open-check, then mounts
 * ONE of two source children. The live child only mounts when the character is open, so its instance
 * already exists - it never materializes a closed character.
 */

/** Stable serialization for the cache change-check (undefined stays undefined). */
function serialize(value: unknown): string | undefined {
   return value === undefined ? undefined : JSON.stringify(value);
}

interface CharacterBoardItemProps {
   item: BoardItem;
   content: CharacterBoardContent;
   /** Caches the reference's last-known read via a direct (non-undoable) write. */
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   onDelete: (id: string) => void;
}

export function CharacterBoardItem({ item, content, onCacheLastKnown, onDelete }: CharacterBoardItemProps) {
   // Open in a tab? Show the live instance. Tabs are keyed by `character.id`, so this needs no drawer
   // read and still resolves an open-but-deleted-source character.
   const isOpen = useTabManagerStore((state) => state.openTabs.some((tab) => tab.id === content.characterId));

   return isOpen
      ? <LiveCharacterSource characterId={content.characterId} sourceDrawerItemId={content.sourceDrawerItemId} />
      : <DrawerCharacterSource item={item} content={content} onCacheLastKnown={onCacheLastKnown} onDelete={onDelete} />;
}

/**
 * The live source: subscribes to the open character's store instance, so an edit in its tab updates
 * the element immediately. Only mounted when the character is open, so the instance already exists.
 */
function LiveCharacterSource({ characterId, sourceDrawerItemId }: { characterId: string; sourceDrawerItemId: string }) {
   const { openCharacterTab } = useTabManagerActions();
   const character = useStore(getOrCreateInstance(characterId), (state) => state.character);

   // An open character never dangles. A momentary null (device-flip hydration) shows the quiet panel.
   if (!character) return <LoadingPanel />;

   return <CharacterBoardOverview character={character} onOpen={() => openCharacterTab(character, sourceDrawerItemId)} />;
}

/**
 * The saved source: the live read-only mirror of the drawer item, used when the character is not open.
 * Caches each read as `lastKnown` so a deleted source degrades to a placeholder.
 */
function DrawerCharacterSource({ item, content, onCacheLastKnown, onDelete }: CharacterBoardItemProps) {
   const { t } = useTranslation();
   const { openCharacterTab } = useTabManagerActions();
   const { content: liveContent, status } = useReferencedDrawerItem(content.sourceDrawerItemId);

   // Live read while present, else the last cached one (so a dangling element still has a name).
   const character = (liveContent ?? content.lastKnown ?? null) as Character | null;

   // Cache the live read as `lastKnown`, change-gated so a re-read doesn't flood the engine. A direct
   // (non-command) write keeps a passive source edit off the board undo stack.
   useEffect(() => {
      if (status !== 'live' || liveContent == null) return;
      if (serialize(liveContent) === serialize(content.lastKnown)) return;
      onCacheLastKnown(item.id, { kind: 'character', sourceDrawerItemId: content.sourceDrawerItemId, characterId: content.characterId, lastKnown: liveContent });
   }, [status, liveContent, content.lastKnown, content.sourceDrawerItemId, content.characterId, item.id, onCacheLastKnown]);

   // Dangling: closed AND the source character was deleted. A placeholder (name from the last read) + remove.
   if (status === 'dangling') {
      const name = (content.lastKnown as Character | undefined)?.name;
      return (
         <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-border bg-popover/95 p-3 text-center shadow-lg backdrop-blur-sm">
            <span className="text-sm font-medium text-foreground">{name || t('BoardView.referenceSourceRemoved')}</span>
            {name && <span className="text-xs text-muted-foreground">{t('BoardView.referenceSourceRemoved')}</span>}
            <button
               type="button"
               onPointerDown={(event) => event.stopPropagation()}
               onClick={() => onDelete(item.id)}
               className="cursor-pointer rounded bg-destructive px-2 py-0.5 text-xs text-destructive-foreground hover:bg-destructive/90"
            >
               {t('BoardView.deleteItem')}
            </button>
         </div>
      );
   }

   // Not yet loaded (first read in flight, no cache): a quiet app-themed panel placeholder.
   if (!character) return <LoadingPanel />;

   return <CharacterBoardOverview character={character} onOpen={() => openCharacterTab(character, content.sourceDrawerItemId)} />;
}

/** A quiet app-themed placeholder shown while the source character is not yet resolved. */
function LoadingPanel() {
   return <div className="h-full w-full rounded-lg border border-border bg-popover/95 shadow-lg backdrop-blur-sm" />;
}
