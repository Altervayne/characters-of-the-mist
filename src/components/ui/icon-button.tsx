// src/components/ui/icon-button.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { motion, type HTMLMotionProps } from 'framer-motion';

const iconButtonVariants = cva(
   'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
   {
      variants: {
         variant: {
            default: 'bg-primary text-primary-foreground hover:bg-primary/90',
            destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
            secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            ghost: 'hover:bg-accent hover:text-accent-foreground',
            link: 'text-primary underline-offset-4 hover:underline',
         },
         size: {
            default: 'h-10 w-10',
            sm: 'h-9 w-9',
            lg: 'h-11 w-11',
         },
      },
      defaultVariants: {
         variant: 'default',
         size: 'default',
      },
   }
);

export interface IconButtonProps
   extends HTMLMotionProps<'button'>,
      VariantProps<typeof iconButtonVariants> {}



const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
   ({ className, variant, size, ...props }, ref) => {
      return (
            <motion.button layout className={cn(iconButtonVariants({ variant, size, className }))}
               ref={ref}
               {...props}
            />
      );
   }
);
IconButton.displayName = 'IconButton';

export { IconButton, iconButtonVariants };