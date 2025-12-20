import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ThemeClassManager } from '@/components/providers/theme-class-manager';
import { AppStartManagerProvider } from '@/components/providers/app-start-manager';
import { router } from '@/router';
import '@/app/global.css';

export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeClassManager>
        <AppStartManagerProvider>
          <RouterProvider router={router} />
          <Toaster
            position="bottom-center"
            toastOptions={{
              className: 'bg-card text-card-foreground border rounded-md shadow-lg',
              style: {
                background: 'var(--card)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              },
            }}
          />
        </AppStartManagerProvider>
      </ThemeClassManager>
    </ThemeProvider>
  );
}