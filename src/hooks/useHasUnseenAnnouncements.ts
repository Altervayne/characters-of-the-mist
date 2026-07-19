// -- Store and Hook Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Utils Imports --
import { hasUnseenAnnouncements } from '@/lib/announcements';

/** True while an announcement is newer than the one the user last dismissed; drives the New! dot. */
export function useHasUnseenAnnouncements(): boolean {
   const lastSeenId = useAppSettingsStore((state) => state.lastSeenAnnouncementId);
   return hasUnseenAnnouncements(lastSeenId);
}
