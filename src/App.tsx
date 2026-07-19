import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ThemeClassManager } from '@/components/providers/ThemeClassManager';
import { AppStartManagerProvider } from '@/components/providers/AppStartManager';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PWAUpdatePrompt from '@/components/PWAUpdatePrompt';
import { OldDomainBanner } from '@/components/OldDomainBanner';
import { router } from '@/router';
import { useDeviceType } from '@/hooks/useDeviceType';
import '@/app/global.css';

function AppContent() {
  const { isMobile } = useDeviceType();

  return (
    <>
      {/* Old-domain "we've moved" shell: the banner reserves the top row, the routed app fills the rest. */}
      <div className="flex flex-col" style={{ height: '100dvh', width: '100dvw' }}>
        <OldDomainBanner />
        <div className="min-h-0 flex-1">
          <RouterProvider router={router} />
        </div>
      </div>
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
        <AppStartManagerProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </AppStartManagerProvider>
      </ThemeClassManager>
    </ThemeProvider>
  );
}