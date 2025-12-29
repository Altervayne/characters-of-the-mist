import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Copy, RefreshCw } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';



export function RouterErrorBoundary() {
   const error = useRouteError();

   let errorMessage = 'An unexpected error occurred';
   let errorDetails = '';

   if (isRouteErrorResponse(error)) {
      errorMessage = `${error.status} ${error.statusText}`;
      errorDetails = error.data?.message || JSON.stringify(error.data);
   } else if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || '';
   } else if (typeof error === 'string') {
      errorMessage = error;
   }

   let errorObj: Error;
   if (error instanceof Error) {
      errorObj = error;
   } else {
      errorObj = new Error(errorMessage);
      if (errorDetails) {
         errorObj.stack = errorDetails;
      }
   }

   return <ErrorFallback error={errorObj} />;
}



function ErrorFallback({ error, resetError }: { error: Error; resetError?: () => void }) {
   const errorMessage = error.message;
   const errorDetails = error.stack || '';

   let appSettings: Record<string, unknown> = {};
   try {
      const storedSettings = localStorage.getItem('characters-of-the-mist_app-settings');
      if (storedSettings) {
         const parsed = JSON.parse(storedSettings);
         appSettings = {
            theme: parsed.state?.theme,
            contextualGame: parsed.state?.contextualGame,
            isCompactDrawer: parsed.state?.isCompactDrawer,
            isSideBySideView: parsed.state?.isSideBySideView,
            isTrackersAlwaysEditable: parsed.state?.isTrackersAlwaysEditable,
            isSidebarCollapsed: parsed.state?.isSidebarCollapsed,
            lastVisitedVersion: parsed.state?.lastVisitedVersion
         };
      }
   } catch (err) {
      console.warn('Failed to read app settings from localStorage:', err);
   }

   const handleCopyError = async () => {
      const appSettingsText = Object.entries(appSettings)
         .map(([key, value]) => `${key}: ${value}`)
         .join('\n');

      const errorText = `Error: ${errorMessage}\n\nDetails:\n${errorDetails}\n\nApp Settings:\n${appSettingsText}\n\nUser Agent: ${navigator.userAgent}\nTimestamp: ${new Date().toISOString()}`;

      if (navigator.clipboard && navigator.clipboard.writeText) {
         try {
            await navigator.clipboard.writeText(errorText);
            toast.success('Error details copied!');
            return;
         } catch (err) {
            console.error('Clipboard API failed:', err);
         }
      }

      try {
         const textarea = document.createElement('textarea');
         textarea.value = errorText;
         textarea.style.position = 'fixed';
         textarea.style.left = '-999999px';
         textarea.style.top = '-999999px';
         document.body.appendChild(textarea);
         textarea.focus();
         textarea.select();
         const successful = document.execCommand('copy');
         document.body.removeChild(textarea);

         if (successful) {
            toast.success('Error details copied!');
         } else {
            toast.error('Failed to copy error details');
         }
      } catch (err) {
         console.error('Fallback copy failed:', err);
         toast.error('Failed to copy error details');
      }
   };

   const handleAction = () => {
      if (resetError) {
         resetError();
      } else {
         window.location.reload();
      }
   };

   return (
      <>
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background">
            <Card className="max-w-2xl w-full border-destructive/50">
            <CardHeader>
               <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-destructive shrink-0" />
                  <div>
                     <CardTitle className="text-2xl">Hey, something unexpected happened</CardTitle>
                     <CardDescription className="mt-1">
                        I'm sorry, but an unexpected error occurred. Please submit a bug report to the Tools of the Mist discord, while explaining what you were doing at the time of the error. You can try reloading the app to fix it.
                     </CardDescription>
                  </div>
               </div>
            </CardHeader>

            <CardContent className="space-y-4">
               <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
                  <p className="font-semibold text-sm text-destructive mb-2">Error Message</p>
                  <p className="text-sm font-mono wrap-break-word">{errorMessage}</p>
               </div>

               {errorDetails && (
                  <div className="rounded-lg bg-muted p-4 max-h-64 overflow-auto">
                     <p className="font-semibold text-sm mb-2">Technical Details</p>
                     <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word">{errorDetails}</pre>
                  </div>
               )}

               {Object.keys(appSettings).length > 0 && (
                  <div className="rounded-lg bg-muted/50 border border-muted p-4">
                     <p className="font-semibold text-sm mb-2">App Settings</p>
                     <div className="text-xs font-mono space-y-1">
                        {Object.entries(appSettings).map(([key, value]) => (
                           <div key={key}>
                              <span className="text-muted-foreground">{key}:</span> {String(value)}
                           </div>
                        ))}
                     </div>
                  </div>
               )}
            </CardContent>

            <CardFooter className="flex gap-2 flex-wrap">
               <Button onClick={handleCopyError} variant="outline" className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copy Error Details
               </Button>
               <Button onClick={handleAction} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  {resetError ? 'Try Again' : 'Reload Page'}
               </Button>
            </CardFooter>
         </Card>
      </div>
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



interface ErrorBoundaryProps {
   children: ReactNode;
}

interface ErrorBoundaryState {
   hasError: boolean;
   error: Error | null;
}



export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
   constructor(props: ErrorBoundaryProps) {
      super(props);
      this.state = {
         hasError: false,
         error: null
      };
   }

   static getDerivedStateFromError(error: Error): ErrorBoundaryState {
      return {
         hasError: true,
         error
      };
   }

   componentDidCatch(error: Error, errorInfo: ErrorInfo) {
      console.error('Error caught by boundary:', error, errorInfo);
   }

   handleReload = () => {
      window.location.reload();
   };

   render() {
      if (this.state.hasError && this.state.error) {
         return <ErrorFallback error={this.state.error} resetError={this.handleReload} />;
      }

      return this.props.children;
   }
}
