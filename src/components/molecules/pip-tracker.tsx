'use client';

// -- React Imports --
import React from 'react';

// -- Next Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Circle } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';



interface PipTrackerProps {
      label?: string;
      value: number;
      onUpdate: (newValue: number) => void;
      maxPips?: number;
      flexDir?: "flex-row" | "flew-row-reverse" | "flex-col" | "flex-col-reverse"
}



export function PipTracker({ label, value, onUpdate, maxPips = 3, flexDir = "flex-col" }: PipTrackerProps) {
   const { t: t } = useTranslation();

   const handleClick = (pipValue: number) => {
      if (value === pipValue) {
         onUpdate(0);
      } else {
         onUpdate(pipValue);
      }
   };

   const pips = Array.from({ length: maxPips }, (_, i) => i + 1);


   
   return (
      <div className={cn('flex flex-1 items-center gap-1', flexDir)}>
         <div className="flex gap-1">
            {pips.map((pip) => (
               <Circle
                  key={pip}
                  className={cn('h-3 w-3 cursor-pointer transition-colors', value >= pip ? 'fill-current' : 'fill-transparent')}
                  onClick={() => handleClick(pip)}
               />
            ))}
         </div>
         {label && <span className="text-xs font-semibold uppercase">{t(label)}</span>}
      </div>
   );
}
