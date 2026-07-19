// -- Type Imports --
import type { SettingsSectionId } from '@/components/organisms/dialogs/settings/SettingsShell';

/**
 * A push message for returning users: it surfaces once in the top banner, then lives in Settings to re-read.
 * Distinct from patch notes (the version changelog) - announcements are timely, one-shot notices. The content
 * is literal English, like patch notes, not translated; only the surrounding banner chrome is localized.
 */
export interface Announcement {
   /** The stable key the watermark stores. Never reuse an id, or a returning user could miss the new notice. */
   id: string;
   date: string;
   title: string;
   /** Markdown, kept short - it renders in a single banner row and in the Settings history. */
   body: string;
   /** `important` tints the banner with the theme accent; `info` (the default) stays neutral. */
   severity?: 'info' | 'important';
   action?: AnnouncementAction;
}

/** An optional call-to-action button: either deep-links into a Settings section, or opens an external URL. */
export interface AnnouncementAction {
   label: string;
   target:
      | { kind: 'settings'; section: SettingsSectionId }
      | { kind: 'external'; href: string };
}

/**
 * The announcements, newest-first. The array order IS the timeline: everything above the watermark entry is
 * unseen. Append new notices at the TOP with a fresh id. Owner authors the real copy; this seed entry only
 * demonstrates the mechanism.
 */
export const announcements: Announcement[] = [
   {
      id: '2026-07-welcome',
      date: '2026-07-19',
      title: 'Welcome to Campaigns of the Mist',
      body: 'Your data lives in this browser. Back it up regularly so a cleared cache never costs you a character.',
      severity: 'important',
      action: { label: 'Open data settings', target: { kind: 'settings', section: 'data' } },
   },
];

/** The newest announcement's id (the watermark seeds here on a fresh install). Empty when there are none. */
export const latestAnnouncementId: string = announcements[0]?.id ?? '';

/**
 * The announcements newer than the watermark, oldest-first for display. The banner walks this list one at a
 * time. An unknown or empty watermark yields the whole list (the user has seen none); the latest id yields an
 * empty list. An empty array yields an empty list, so callers never special-case it.
 */
export function unseenAnnouncements(lastSeenId: string): Announcement[] {
   const seenIndex = announcements.findIndex((announcement) => announcement.id === lastSeenId);
   // Everything newer than the watermark sits BEFORE it in this newest-first array; -1 (unknown) means all.
   const unseenNewestFirst = seenIndex === -1 ? announcements : announcements.slice(0, seenIndex);
   return unseenNewestFirst.slice().reverse();
}

/** Whether any announcement is newer than the watermark (drives the Settings New! dot). */
export function hasUnseenAnnouncements(lastSeenId: string): boolean {
   return unseenAnnouncements(lastSeenId).length > 0;
}

/**
 * The watermark value that replays the banner FROM `id` forward: it points one notice OLDER than `id`, so `id`
 * becomes the oldest unseen again and rides the banner (with everything newer than it). The oldest announcement
 * rewinds to '' (nothing seen). An unknown id is left at the latest (nothing to replay).
 */
export function rewindWatermarkFor(id: string): string {
   const index = announcements.findIndex((announcement) => announcement.id === id);
   if (index === -1) return latestAnnouncementId;
   return announcements[index + 1]?.id ?? '';
}
