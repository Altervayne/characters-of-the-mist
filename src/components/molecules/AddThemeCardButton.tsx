// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { PlusCircle } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';



interface AddCardButtonProps {
   onClick: () => void;
}



export function AddCardButton({ onClick }: AddCardButtonProps) {
   const { t: t } = useTranslation();

   return (
      <div
         data-tutorial="add-card-button"
         onClick={onClick}
         className={cn(
            "cursor-pointer flex flex-col gap-4 items-center justify-center min-w-62.5 w-62.5 max-h-150 h-150 p-4",
            "rounded-lg border-2 border-dashed border-bg text-bg border-border text-muted-foreground text-center bg-muted/50",
            "hover:text-foreground hover:border-foreground transition-all duration-150"
         )}
      >
         <PlusCircle className="w-10 h-10" />
         <span className="text-3xl font-semibold">{t('CharacterSheetPage.addCard')}</span>
      </div>
   );
}
