import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ThemeClassManager } from '@/components/providers/ThemeClassManager';
import { AppStartManagerProvider } from '@/components/providers/AppStartManager';
import { ActiveCharacterStoreProvider } from '@/lib/character/ActiveCharacterStoreProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PWAUpdatePrompt from '@/components/PWAUpdatePrompt';
import { router } from '@/router';
import { useDeviceType } from '@/hooks/useDeviceType';
import '@/app/global.css';

function AppContent() {
  const { isMobile } = useDeviceType();

  return (
    <>
      <RouterProvider router={router} />
      <PWAUpdatePrompt />
      <Toaster
        position={isMobile ? 'top-center' : 'bottom-center'}
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
        {/* Resolution layer for the active character store. Hoisted above
            AppStartManagerProvider because that provider consumes the store (via
            useAppTourDriver), so it too must sit inside the provider; this covers
            every character consumer in the app. */}
        <ActiveCharacterStoreProvider>
          <AppStartManagerProvider>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </AppStartManagerProvider>
        </ActiveCharacterStoreProvider>
      </ThemeClassManager>
    </ThemeProvider>
  );
}