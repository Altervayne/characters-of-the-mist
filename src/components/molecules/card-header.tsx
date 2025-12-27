

// -- React Imports --
import React from 'react';

// -- Next Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Leaf, Swords, Crown } from 'lucide-react';

// -- Basic UI Imports --
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// -- Utils Imports --
import { cn } from '@/lib/utils';



interface CardHeaderMoleculeProps {
   title: string;
   type?: string;
   game?: string;
   className?: string;
}



const ThemeTypeIcon = ({ type, game }: { type: string; game?: string }) => {
   const { t: t } = useTranslation();
   const translationKey = type as string

   let IconComponent;

   // Otherscape theme icons
   if (game === 'OTHERSCAPE') {
      if (type === 'Self') {
         IconComponent = (
            <div className="h-5 w-5" style={{ filter: 'brightness(0) saturate(100%) invert(100%)' }}>
               <img src="/icons/Themes/os_self.svg" alt="Self" width={20} height={20} className="h-5 w-5" />
            </div>
         );
      } else if (type === 'Noise') {
         IconComponent = (
            <div className="h-5 w-5" style={{ filter: 'brightness(0) saturate(100%) invert(100%)' }}>
               <img src="/icons/Themes/os_noise.svg" alt="Noise" width={20} height={20} className="h-5 w-5" />
            </div>
         );
      } else if (type === 'Mythos') {
         IconComponent = (
            <div className="h-5 w-5" style={{ filter: 'brightness(0) saturate(100%) invert(100%)' }}>
               <img src="/icons/Themes/os_mythos.svg" alt="Mythos" width={20} height={20} className="h-5 w-5" />
            </div>
         );
      }
   }
   // City of Mist theme icons
   else if (game === 'CITY_OF_MIST') {
      if (type === 'Logos') {
         IconComponent = (
            <div className="h-5 w-5" style={{ filter: 'brightness(0) saturate(100%) invert(100%)' }}>
               <img src="/icons/Themes/com_logos.svg" alt="Logos" width={20} height={20} className="h-5 w-5" />
            </div>
         );
      } else if (type === 'Mythos') {
         IconComponent = (
            <div className="h-5 w-5" style={{ filter: 'brightness(0) saturate(100%) invert(100%)' }}>
               <img src="/icons/Themes/com_mythos.svg" alt="Mythos" width={20} height={20} className="h-5 w-5" />
            </div>
         );
      }
   }
   // Legends in the Mist theme icons (Lucide)
   else {
      switch (type) {
         case 'Origin':
            IconComponent = <Leaf className="h-5 w-5" strokeWidth={2.5}/>;
            break;
         case 'Adventure':
            IconComponent = <Swords className="h-5 w-5" strokeWidth={2.5}/>;
            break;
         case 'Greatness':
            IconComponent = <Crown className="h-5 w-5" strokeWidth={2.5}/>;
            break;
         default:
            return <p>{type}</p>;
      }
   }

   return (
      <TooltipProvider delayDuration={300}>
         <Tooltip>
            <TooltipTrigger asChild>
               <div>{IconComponent}</div>
            </TooltipTrigger>
            <TooltipContent>
               <p>{t(translationKey as string)}</p>
            </TooltipContent>
         </Tooltip>
      </TooltipProvider>
   );
};



export function CardHeaderMolecule({ title, type, game, className }: CardHeaderMoleculeProps) {
   return (
      <div
         className={cn(
            'flex items-center font-semibold border-b h-10',
            'bg-card-header-bg text-card-header-fg border-card-accent/30',
            type ? 'justify-between px-2 py-2 text-sm'
                  : 'justify-center px-2 py-2 text-md font-bold',
            className
         )}
      >
         <p>{title}</p>
         {type && <ThemeTypeIcon type={type} game={game} />}
      </div>
   );
}
