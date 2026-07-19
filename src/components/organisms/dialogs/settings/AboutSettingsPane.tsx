// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// -- Component Imports --
import MarkdownContent from '@/components/molecules/MarkdownContent';

// -- Localization Imports --
import { buildLocalizationCreditsMarkdown } from '@/i18n/locales';



/**
 * The About section: the app/license/credits body folded out of the old InfoDialog, its inner Radix tabs kept
 * as-is. The shell owns closing, so the dialog's footer close button is dropped.
 */
export function AboutSettingsPane() {
   const { t } = useTranslation();

   return (
      <div className="flex h-full flex-col gap-4">
         <p className="shrink-0 text-sm text-muted-foreground">{t('InfoDialog.description')}</p>

         <Tabs defaultValue="about" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="grid w-full shrink-0 grid-cols-3">
               <TabsTrigger className="cursor-pointer" value="about">{t('InfoDialog.tabs.about')}</TabsTrigger>
               <TabsTrigger className="cursor-pointer" value="license">{t('InfoDialog.tabs.license')}</TabsTrigger>
               <TabsTrigger className="cursor-pointer" value="credits">{t('InfoDialog.tabs.credits')}</TabsTrigger>
            </TabsList>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto p-1 pr-4">
               <TabsContent value="about">
                  <MarkdownContent content={t('InfoDialog.content.about')} />
               </TabsContent>

               <TabsContent value="license">
                  <MarkdownContent content={t('InfoDialog.content.license')} />
                  <a
                     href="https://www.gnu.org/licenses/agpl-3.0.html"
                     target="_blank"
                     rel="license noopener noreferrer"
                     className="inline-block my-4 text-sm underline"
                  >
                     GNU Affero General Public License v3.0
                  </a>
                  <p className="text-xs text-muted-foreground">{t('InfoDialog.license_credit')}</p>
               </TabsContent>

               <TabsContent value="credits">
                  <MarkdownContent content={t('InfoDialog.content.credits')} />

                  <MarkdownContent content={t('InfoDialog.content.localization')} />
                  <MarkdownContent content={buildLocalizationCreditsMarkdown()} />
               </TabsContent>
            </div>
         </Tabs>
      </div>
   );
}
