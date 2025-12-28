import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Copy, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

export function ErrorBoundary() {
   const error = useRouteError();
   const { t } = useTranslation();
   const appSettings = useAppSettingsStore((state) => ({
      theme: state.theme,
      contextualGame: state.contextualGame,
      isCompactDrawer: state.isCompactDrawer,
      isSideBySideView: state.isSideBySideView,
      isTrackersAlwaysEditable: state.isTrackersAlwaysEditable,
      isSidebarCollapsed: state.isSidebarCollapsed
   }));

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

   const handleCopyError = async () => {
      const appSettingsText = Object.entries(appSettings)
         .map(([key, value]) => `${key}: ${value}`)
         .join('\n');

      const errorText = `Error: ${errorMessage}\n\nDetails:\n${errorDetails}\n\nApp Settings:\n${appSettingsText}\n\nUser Agent: ${navigator.userAgent}\nTimestamp: ${new Date().toISOString()}`;


      if (navigator.clipboard && navigator.clipboard.writeText) {
         try {
            await navigator.clipboard.writeText(errorText);
            toast.success(t('Errors.ErrorBoundary.copySuccess'));
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
            toast.success(t('Errors.ErrorBoundary.copySuccess'));
         } else {
            toast.error(t('Errors.ErrorBoundary.copyFailed'));
         }
      } catch (err) {
         console.error('Fallback copy failed:', err);
         toast.error(t('Errors.ErrorBoundary.copyFailed'));
      }
   };

   const handleReload = () => {
      window.location.reload();
   };

   return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-black/80">
         <Card className="max-w-2xl w-full border-destructive/50">
            <CardHeader>
               <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-destructive shrink-0" />
                  <div>
                  <CardTitle className="text-2xl">{t('Errors.ErrorBoundary.title')}</CardTitle>
                  <CardDescription className="mt-1">
                     {t('Errors.ErrorBoundary.description')}
                  </CardDescription>
                  </div>
               </div>
            </CardHeader>

            <CardContent className="space-y-4">
               <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
                  <p className="font-semibold text-sm text-destructive mb-2">{t('Errors.ErrorBoundary.errorMessage')}</p>
                  <p className="text-sm font-mono wrap-break-word">{errorMessage}</p>
               </div>

               {errorDetails && (
                  <div className="rounded-lg bg-muted p-4 max-h-64 overflow-auto">
                  <p className="font-semibold text-sm mb-2">{t('Errors.ErrorBoundary.technicalDetails')}</p>
                  <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word">{errorDetails}</pre>
                  </div>
               )}

               <div className="rounded-lg bg-muted/50 border border-muted p-4">
                  <p className="font-semibold text-sm mb-2">{t('Errors.ErrorBoundary.appSettings')}</p>
                  <div className="text-xs font-mono space-y-1">
                  {Object.entries(appSettings).map(([key, value]) => (
                     <div key={key}>
                        <span className="text-muted-foreground">{key}:</span> {String(value)}
                     </div>
                  ))}
                  </div>
               </div>
            </CardContent>

            <CardFooter className="flex gap-2 flex-wrap">
               <Button onClick={handleCopyError} variant="outline" className="gap-2">
                  <Copy className="h-4 w-4" />
                  {t('Errors.ErrorBoundary.copyButton')}
               </Button>
               <Button onClick={handleReload} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  {t('Errors.ErrorBoundary.reloadButton')}
               </Button>
            </CardFooter>
         </Card>
      </div>
   );
}
