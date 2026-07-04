// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Skull } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';



interface AddChallengeCardButtonProps {
   onClick: () => void;
}



export function AddChallengeCardButton({ onClick }: AddChallengeCardButtonProps) {
   const { t } = useTranslation();

   return (
      <div
         data-tour="add-challenge-button"
         onClick={onClick}
         className={cn(
            "cursor-pointer flex flex-col gap-4 items-center justify-center min-w-62.5 w-62.5 max-h-150 h-150 p-4",
            "rounded-lg border-2 border-dashed border-bg text-bg border-border text-muted-foreground text-center bg-muted/50",
            "hover:text-foreground hover:border-foreground transition-all duration-150"
         )}
      >
         <Skull className="w-10 h-10" />
         <span className="text-3xl font-semibold">{t('CharacterSheetPage.addChallenge')}</span>
      </div>
   );
}
