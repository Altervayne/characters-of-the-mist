// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// -- Component Imports --
import MarkdownContent from '../molecules/markdown-content';



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
                     <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/" className="inline-block my-4">
                        <img
                           alt="Creative Commons License"
                           width={88}
                           height={31}
                           src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png"
                        />
                     </a>
                     <p className="text-xs text-muted-foreground">{t('InfoDialog.license_credit')}</p>
                  </TabsContent>

                  <TabsContent value="credits">
                     <MarkdownContent content={t('InfoDialog.content.credits')} />

                     <MarkdownContent content={t('InfoDialog.content.localization')} />
                     <MarkdownContent content={localizationContributors} />

                     <MarkdownContent content={t('InfoDialog.content.support')} />
                     <a href="https://ko-fi.com/altervayne" target="_blank" rel="noopener noreferrer" className="inline-block mt-4">
                        <img
                           alt={t('InfoDialog.kofi_alt')}
                           src="https://storage.ko-fi.com/cdn/brandasset/kofi_button_dark.png"
                           width={214}
                           height={40}
                        />
                     </a>
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