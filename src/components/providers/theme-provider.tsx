'use client';

// -- React Imports --
import * as React from 'react';

// -- Next Imports --
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';



export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
   return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}