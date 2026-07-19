// -- React Imports --
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

// -- Icon Imports --
import { RotateCcw } from 'lucide-react';

// -- Component Imports --
import { Button } from '@/components/ui/button';
import MarkdownContent from '@/components/molecules/MarkdownContent';

// -- Store and Utils Imports --
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { announcements, rewindWatermarkFor } from '@/lib/announcements';

/**
 * The Announcements history: every past notice, newest-first, to re-read. Opening it never touches the watermark
 * (the banner is the sole acknowledgment path), so the New! dot persists until the banner is dismissed. Each notice
 * carries a Rewind control that re-points the watermark so it (and anything newer) rides the banner again.
 */
export function AnnouncementsSettingsPane() {
   const { t } = useTranslation();
   const { setLastSeenAnnouncementId } = useAppSettingsActions();

   const rewind = (id: string) => {
      setLastSeenAnnouncementId(rewindWatermarkFor(id));
      toast.success(t('AnnouncementsSettings.rewound'));
   };

   return (
      <div className="flex h-full flex-col gap-4">
         <p className="shrink-0 text-sm text-muted-foreground">{t('AnnouncementsSettings.description')}</p>

         <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {announcements.length === 0 ? (
               <p className="text-sm text-muted-foreground">{t('AnnouncementsSettings.empty')}</p>
            ) : (
               <ul className="flex flex-col gap-3">
                  {announcements.map((announcement) => (
                     <li key={announcement.id} className="rounded-lg border border-border bg-card p-4">
                        <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{announcement.date}</div>
                        <h3 className="text-base font-semibold text-foreground">{announcement.title}</h3>
                        <div className="mt-1 [&_p]:mb-0">
                           <MarkdownContent content={announcement.body} />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => rewind(announcement.id)} className="mt-3 cursor-pointer">
                           <RotateCcw className="mr-1 h-3.5 w-3.5" />
                           {t('AnnouncementsSettings.rewind')}
                        </Button>
                     </li>
                  ))}
               </ul>
            )}
         </div>
      </div>
   );
}
