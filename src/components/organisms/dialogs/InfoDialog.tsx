// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// -- Component Imports --
import MarkdownContent from '@/components/molecules/MarkdownContent';



interface InfoDialogProps {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
}



export function InfoDialog({ isOpen, onOpenChange }: InfoDialogProps) {
   const { t: t } = useTranslation();
   
   const localizationContributors = '- **Deutsch:** Markus Raab'

   
   return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
         <DialogContent className="max-w-2xl">
            <DialogHeader>
               <DialogTitle>{t('InfoDialog.title')}</DialogTitle>
               <DialogDescription>{t('InfoDialog.description')}</DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="about" className="pt-4">
               <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger className="cursor-pointer" value="about">{t('InfoDialog.tabs.about')}</TabsTrigger>
                  <TabsTrigger className="cursor-pointer" value="license">{t('InfoDialog.tabs.license')}</TabsTrigger>
                  <TabsTrigger className="cursor-pointer" value="credits">{t('InfoDialog.tabs.credits')}</TabsTrigger>
               </TabsList>

               <div className="mt-4 max-h-[60vh] overflow-y-auto p-1 pr-4">
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
                     <MarkdownContent content={localizationContributors} />
                  </TabsContent>
               </div>
            </Tabs>
            
            <DialogFooter>
               <Button className="cursor-pointer" title={t('InfoDialog.close')} onClick={() => onOpenChange(false)}>{t('InfoDialog.close')}</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}