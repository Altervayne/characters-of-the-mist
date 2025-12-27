

// -- React Imports --
import { useEffect } from 'react';

// -- Store and Hook Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';



export function ThemeClassManager({ children }: { children: React.ReactNode }) {
   const theme = useAppSettingsStore((state) => state.theme);

   useEffect(() => {
      const rootClasses = document.documentElement.classList;

      const classesToRemove = Array.from(rootClasses).filter(className => 
         className.startsWith('theme-')
      );
      classesToRemove.forEach(className => rootClasses.remove(className));

      if (theme) {
         rootClasses.add(theme);
      }
   }, [theme]);

   return <>{children}</>;
}