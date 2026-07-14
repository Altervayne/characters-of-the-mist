// -- React Imports --
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import cuid from 'cuid';
import toast from 'react-hot-toast';

// -- Store Imports --
import { getActiveBoardStore } from '@/lib/board/boardStoreRegistry';

// -- Utils Imports --
import { trackerBoardItemForMention } from '@/lib/board/mintTrackerFromMention';
import { nextScopeZ } from '@/lib/board/boardTree';

// -- Type Imports --
import type { MentionSegment } from '@/lib/challenge/parseMentions';

/*
 * The shared board-scope handler for a tapped mention: mint a fresh board-native tracker beside the host
 * item (create-only - a freeform board isn't single-owner, so no raise/dedup). Used by the challenge card
 * copy and the note bodies (post-it / journal). Minting goes through the BOARD store, never character
 * actions (a board embed runs its own throwaway per-embed store). A per-host cascade nudges repeated taps
 * so they don't stack exactly. The callback is rebuilt only when the host moves.
 */

interface HostRect {
   x: number;
   y: number;
   width: number;
   height: number;
}

export function useBoardMentionMint(host: HostRect): (segment: MentionSegment) => void {
   const { t } = useTranslation();
   const cascadeRef = useRef(0);

   return useCallback((segment: MentionSegment) => {
      const boardStore = getActiveBoardStore();
      const spec = trackerBoardItemForMention(segment, host, cascadeRef.current);
      if (!boardStore || !spec) return;
      cascadeRef.current += 1;
      // A minted tracker spawns at root (beside its host), so it lands at the front of the root scope.
      const z = nextScopeZ(boardStore.getState().items, null);
      void boardStore.getState().actions.addItem({ id: cuid(), z, ...spec });
      if (segment.type !== 'text') toast.success(t('BoardView.mentionAdded', { name: segment.name }));
   }, [host, t]);
}
