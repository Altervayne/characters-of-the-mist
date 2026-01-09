import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ThemeClassManager } from '@/components/providers/ThemeClassManager';
import { AppStartManagerProvider } from '@/components/providers/AppStartManager';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { router } from '@/router';
import '@/app/global.css';

function AppContent() {
  return (
    <>
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
    </>
  );
}

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
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </AppStartManagerProvider>
      </ThemeClassManager>
    </ThemeProvider>
  );
}