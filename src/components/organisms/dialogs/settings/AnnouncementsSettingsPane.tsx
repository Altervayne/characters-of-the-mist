// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import MarkdownContent from '@/components/molecules/MarkdownContent';

// -- Utils Imports --
import { announcements } from '@/lib/announcements';

/**
 * The Announcements history: every past notice, newest-first, to re-read. Purely read-only - opening it never
 * touches the watermark (the banner is the sole acknowledgment path), so the New! dot persists until the banner
 * itself is dismissed.
 */
export function AnnouncementsSettingsPane() {
   const { t } = useTranslation();

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
                     </li>
                  ))}
               </ul>
            )}
         </div>
      </div>
   );
}
