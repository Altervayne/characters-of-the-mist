// -- React Imports --
import { useEffect, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Link2, Unlink } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Board Imports --
import { useReferencedDrawerItem } from '@/lib/board/useReferencedDrawerItem';
import { detachToCopy, toReferenceContent } from '@/lib/board/referenceContent';

// -- Type Imports --
import type { BoardItem, BoardItemContent, CardBoardContent, TrackerBoardContent } from '@/lib/types/board';

/*
 * Shared chrome for an embedded card/tracker item: it resolves copy vs reference, renders
 * the live mirror for a reference (read-only), handles the copy<->reference toggle, shows
 * the "linked" badge, caches a reference's last-known snapshot, and degrades a dangling
 * reference to a placeholder with convert/remove. The actual card/tracker render is
 * delegated to `renderSnapshot`, so card and tracker bodies share all of this.
 */

interface EmbeddedItemProps {
   item: BoardItem;
   content: CardBoardContent | TrackerBoardContent;
   isSelected: boolean;
   /** Commits a content change as an undoable command (the toggle uses this). */
   onContentChange: (content: BoardItemContent) => void;
   /** Caches a reference's last-known snapshot via a direct write (not undoable). */
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   onDelete: (id: string) => void;
   /** Renders the resolved card/tracker data as its real component (snapshot, read-only). */
   renderSnapshot: (data: unknown) => ReactNode;
}

/** Stable serialization for change detection (undefined stays undefined so an unset cache differs from any value). */
function serialize(value: unknown): string | undefined {
   return value === undefined ? undefined : JSON.stringify(value);
}

export function EmbeddedItem({ item, content, isSelected, onContentChange, onCacheLastKnown, onDelete, renderSnapshot }: EmbeddedItemProps) {
   const { t } = useTranslation();

   const isReference = content.mode === 'reference';
   const sourceId = content.sourceDrawerItemId ?? null;
   // Called unconditionally; idle (no read) for a copy, which passes `null`.
   const { content: liveContent, status } = useReferencedDrawerItem(isReference ? sourceId : null);

   // Cache the live content onto the reference as `lastKnown`, but ONLY when it actually
   // changed - a write on every read would flood the engine. A direct (non-command) write
   // keeps a passive source edit off the board undo stack.
   useEffect(() => {
      if (!isReference || !sourceId || status !== 'live' || liveContent == null) return;
      const cached = content.mode === 'reference' ? content.lastKnown : undefined;
      if (serialize(liveContent) === serialize(cached)) return;
      onCacheLastKnown(item.id, toReferenceContent(content, sourceId, liveContent));
   }, [isReference, sourceId, status, liveContent, content, item.id, onCacheLastKnown]);

   const detach = (): void => onContentChange(detachToCopy(content, liveContent));
   const makeReference = (): void => {
      if (!content.sourceDrawerItemId) return;
      onContentChange(toReferenceContent(content, content.sourceDrawerItemId));
   };

   // Dangling reference: never error or vanish - offer convert-to-copy (if recoverable) / remove.
   if (isReference && status === 'dangling') {
      const recoverable = content.mode === 'reference' && content.lastKnown !== undefined;
      return (
         <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-card p-2 text-center">
            <span className="text-xs text-muted-foreground">{t('BoardView.referenceSourceRemoved')}</span>
            <div className="flex gap-1">
               {recoverable && (
                  <EmbeddedControl title={t('BoardView.convertToCopy')} onClick={detach}>
                     {t('BoardView.convertToCopy')}
                  </EmbeddedControl>
               )}
               <EmbeddedControl title={t('BoardView.deleteItem')} destructive onClick={() => onDelete(item.id)}>
                  {t('BoardView.deleteItem')}
               </EmbeddedControl>
            </div>
         </div>
      );
   }

   // The data to render: a reference shows live (or last-known until the first read lands);
   // a copy shows its own snapshot.
   const data = isReference
      ? liveContent ?? (content.mode === 'reference' ? content.lastKnown ?? null : null)
      : content.mode === 'copy'
         ? content.data
         : null;

   return (
      <div className="relative h-full w-full">
         {data != null ? (
            <div className="flex h-full w-full items-center justify-center overflow-hidden bg-card pointer-events-none">
               {renderSnapshot(data)}
            </div>
         ) : (
            <EmbeddedFallback label={t('BoardView.embeddedUnavailable')} />
         )}

         {/* Linked badge: always shown on a reference, so it reads distinct from a copy. */}
         {isReference && (
            <span
               className="absolute left-1 top-1 flex items-center justify-center rounded bg-primary/90 p-0.5 text-primary-foreground shadow-sm"
               title={t('BoardView.linkedBadge')}
               aria-label={t('BoardView.linkedBadge')}
            >
               <Link2 className="h-3 w-3" />
            </span>
         )}

         {/* Copy<->reference toggle, shown when selected. */}
         {isSelected && (
            <div className="absolute right-1 top-1 flex gap-1">
               {isReference ? (
                  <EmbeddedControl title={t('BoardView.convertToCopy')} onClick={detach}>
                     <Unlink className="h-3.5 w-3.5" />
                  </EmbeddedControl>
               ) : content.sourceDrawerItemId ? (
                  <EmbeddedControl title={t('BoardView.makeReference')} onClick={makeReference}>
                     <Link2 className="h-3.5 w-3.5" />
                  </EmbeddedControl>
               ) : null}
            </div>
         )}
      </div>
   );
}

/** A neutral placeholder when an embedded item can't be rendered (missing renderer / unloaded). */
export function EmbeddedFallback({ label }: { label: string }) {
   return (
      <div className="flex h-full w-full items-center justify-center bg-card p-2 text-center text-xs text-muted-foreground">
         {label}
      </div>
   );
}

/** A small on-item control; stops the drag so the click lands reliably under pointer capture. */
function EmbeddedControl({
   title,
   destructive = false,
   onClick,
   children,
}: {
   title: string;
   destructive?: boolean;
   onClick: () => void;
   children: ReactNode;
}) {
   return (
      <button
         type="button"
         title={title}
         aria-label={title}
         onPointerDown={(event: ReactPointerEvent) => event.stopPropagation()}
         onClick={onClick}
         className={cn(
            'flex items-center justify-center rounded px-1 py-0.5 text-xs opacity-90 shadow-sm cursor-pointer',
            destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
         )}
      >
         {children}
      </button>
   );
}
