// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// -- Icon Imports --
import { RotateCcw } from 'lucide-react';

// -- Component Imports --
import { DesktopTutorialList } from './DesktopTutorialList';

// -- Store and Hook Imports --
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';



/** The Learn section: restart the first-run onboarding. The tutorial list lands here once its engine ships. */
export function LearnSettingsPane() {
   const { t } = useTranslation();
   const { setSettingsOpen, setDesktopOnboardingOpen } = useAppGeneralStateActions();

   // Replay the first-run onboarding on demand; close the hub first so it isn't left behind the wash.
   const handleReplayOnboarding = () => {
      setSettingsOpen(false);
      setDesktopOnboardingOpen(true);
   };

   return (
      <div className="grid gap-6">
         <div className="grid grid-cols-3 items-center gap-4">
            <Label className="text-left">{t('SettingsDialog.onboarding')}</Label>
            <Button onClick={handleReplayOnboarding} title={t('SettingsDialog.onboardingButton')} className="col-span-2 cursor-pointer min-w-0">
               <RotateCcw className="mr-2 h-4 w-4 shrink-0" />
               <span className="truncate">{t('SettingsDialog.onboardingButton')}</span>
            </Button>
         </div>

         {/* The tutorial list (start/replay + a completed check), the target of the palette's openTutorials
             deep-link. Renders nothing until the real tutorials are authored, so no empty header leaks. */}
         <DesktopTutorialList />
      </div>
   );
}
