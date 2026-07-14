// -- Store and Hook Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Utils Imports --
import { hasUnreadPatchNotes } from '@/lib/patch-notes';

/** True while the newest release is newer than the one the user last opened What's-new for; drives the New! dot. */
export function useHasUnreadPatchNotes(): boolean {
   const lastReadVersion = useAppSettingsStore((state) => state.lastReadPatchNotesVersion);
   return hasUnreadPatchNotes(lastReadVersion);
}
