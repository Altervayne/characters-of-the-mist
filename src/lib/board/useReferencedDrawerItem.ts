// -- React Imports --
import { useEffect, useState } from 'react';

// -- Drawer Imports --
import { getItem } from '@/lib/drawer/drawerRepository';
import { drawerCommandEngine } from '@/lib/drawer/drawerCommandEngine';

// -- Type Imports --
import type { DrawerItemContent } from '@/lib/types/drawer';

/*
 * The live read-only mirror behind a board reference item: it reads its source drawer
 * item's content and re-reads when the drawer changes. This is the app's one cross-domain
 * live link (board-spec §5.2): edit at the source, the board reflects it. Never writes
 * back.
 *
 * In-session reactivity rides `drawerCommandEngine.subscribe` (fires on every drawer
 * command). On-load is guaranteed because the hook re-reads on mount.
 *
 * Known boundary: the character->drawer direct save (`saveCharacterToLinkedDrawerItem`)
 * writes the drawer item WITHOUT a drawer command, so a reference may not reflect that
 * specific edit until the next re-read trigger (reload / drawer reopen). A unified
 * drawer-change signal is a later improvement; this leans on the command-engine signal.
 */

/** The resolved state of a reference's source: live content, or dangling when the source is gone. */
export interface ReferencedDrawerItem {
   content: DrawerItemContent | null;
   status: 'live' | 'dangling';
}

/**
 * Reads the current content of drawer item `sourceDrawerItemId`. Pure data access (no
 * React) so the re-read behaviour is unit-testable against the repository.
 */
export async function resolveReferencedDrawerItem(sourceDrawerItemId: string): Promise<ReferencedDrawerItem> {
   const record = await getItem(sourceDrawerItemId);
   return record ? { content: record.content, status: 'live' } : { content: null, status: 'dangling' };
}

/**
 * Subscribes to a referenced drawer item, returning its live content + status. Pass
 * `null` for a non-reference (copy) item; the hook then stays idle. Re-reads on the
 * source id changing and on every drawer command.
 */
export function useReferencedDrawerItem(sourceDrawerItemId: string | null): ReferencedDrawerItem {
   const [result, setResult] = useState<ReferencedDrawerItem>({ content: null, status: 'live' });

   useEffect(() => {
      if (!sourceDrawerItemId) return;
      let cancelled = false;
      const reread = (): void => {
         void resolveReferencedDrawerItem(sourceDrawerItemId).then((next) => {
            if (!cancelled) setResult(next);
         });
      };
      reread();
      const unsubscribe = drawerCommandEngine.subscribe(reread);
      return () => {
         cancelled = true;
         unsubscribe();
      };
   }, [sourceDrawerItemId]);

   // A copy passes `null`: stay idle (the stale `result` is never read for a copy).
   return sourceDrawerItemId ? result : { content: null, status: 'live' };
}
