// -- Icon Imports --
import { Megaphone, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import MarkdownContent from '@/components/molecules/MarkdownContent';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { unseenAnnouncements } from '@/lib/announcements';

// -- Store and Hook Imports --
import { useAppSettingsStore, useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

/**
 * The returning-user announcement channel: an in-flow row that reserves its own height at the very top of the
 * app (a flex column below it), so it pushes the workspace down instead of covering it - the same shape as the
 * dev-preview warning it sits beside, and it reserves height above both the desktop and mobile shells at once.
 *
 * It shows the OLDEST unseen announcement; dismissing (or acting on its CTA) advances the watermark to that
 * announcement, so the next one surfaces, until the watermark reaches the latest and the row renders nothing
 * (no reserved height). `important` severity tints the row with the theme accent; a CTA either deep-links a
 * Settings section or opens an external URL.
 */
export function AnnouncementBanner() {
   const { t } = useTranslation();
   const lastSeenId = useAppSettingsStore((state) => state.lastSeenAnnouncementId);
   const { setLastSeenAnnouncementId } = useAppSettingsActions();
   const { setSettingsInitialSection, setSettingsOpen } = useAppGeneralStateActions();

   const current = unseenAnnouncements(lastSeenId)[0];
   if (!current) return null;

   const isImportant = current.severity === 'important';

   // Acknowledging the announcement moves the watermark to it, revealing the next unseen (or clearing the row).
   const acknowledge = () => setLastSeenAnnouncementId(current.id);

   const handleAction = () => {
      const action = current.action;
      if (action) {
         if (action.target.kind === 'settings') {
            setSettingsInitialSection(action.target.section);
            setSettingsOpen(true);
         } else {
            window.open(action.target.href, '_blank', 'noopener,noreferrer');
         }
      }
      // Acting on a CTA is acknowledging it too.
      acknowledge();
   };

   return (
      <div
         className={cn(
            'pt-safe relative z-40 shrink-0 border-b border-border bg-card text-card-foreground shadow-sm',
            // Important notices carry a leading accent bar and a faint accent wash, tinting the row without
            // sacrificing the legibility of the foreground text on top.
            isImportant && 'border-l-4 border-l-primary bg-primary/10',
         )}
      >
         {/* Dismiss stays pinned top-right so the content beside it can flow and wrap freely (the `pr-12`
             below keeps the wrapping text clear of it). */}
         <IconButton
            variant="ghost"
            size="sm"
            onClick={acknowledge}
            aria-label={t('AnnouncementBanner.dismiss')}
            className="absolute right-2 top-2 size-8"
         >
            <X className="size-4" />
         </IconButton>

         {/* A wrapping row: on a wide viewport the icon, text and CTA sit inline; when the text block's basis
             no longer fits, the CTA wraps to its own line under the message. */}
         <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 pr-12">
            <Megaphone
               className={cn('size-4 shrink-0 self-start', isImportant ? 'text-primary' : 'text-muted-foreground')}
               aria-hidden
            />

            <div className="min-w-0 flex-1 basis-64">
               <p className="text-sm font-semibold leading-tight text-foreground">{current.title}</p>
               {/* Compact markdown body: the shared renderer, with its paragraph margins flattened for a row. */}
               <div className="mt-0.5 [&_p]:mb-0 [&_p]:text-xs">
                  <MarkdownContent content={current.body} />
               </div>
            </div>

            {current.action && (
               <Button variant={isImportant ? 'default' : 'outline'} size="sm" onClick={handleAction} className="shrink-0">
                  {current.action.label}
               </Button>
            )}
         </div>
      </div>
   );
}
