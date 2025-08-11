'use client';

// -- React Imports --
import React from 'react';

// -- Other Library Imports --
import { LucideProps } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';



interface SectionHeaderProps {
      title: string;
      icon?: React.ElementType<LucideProps>;
      className?: string;
}



export function CardSectionHeader({ title, icon: Icon, className }: SectionHeaderProps) {
   return (
      <h3
         className={cn(
            'w-[100%] py-0.5 text-md font-bold text-center flex items-center justify-center gap-2',
            'border-y border-card-border/30',
            'bg-card-popover-bg text-card-popover-fg',
            className
         )}
      >
         {Icon && <Icon className="h-4 w-4" />}
         <span>{title}</span>
      </h3>
   );
}
