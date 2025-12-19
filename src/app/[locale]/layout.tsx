// -- Next Imports --
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

// -- Other Library Imports --
import { Toaster } from 'react-hot-toast';

// -- Utils Imports --
import '@/app/global.css';

// -- Component Imports --
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ThemeClassManager } from '@/components/providers/theme-class-manager';
import { AppStartManagerProvider } from '@/components/providers/app-start-manager';



const inter = Inter({ subsets: ['latin'] });

const APP_NAME = "Characters of the Mist";
const APP_DEFAULT_TITLE = "Characters of the Mist";
const APP_TITLE_TEMPLATE = "%s - CotM";
const APP_DESCRIPTION = "An unofficial Son of Oak Games character creator and manager.";

export const metadata: Metadata = {
   applicationName: APP_NAME,
   title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
   },
   description: APP_DESCRIPTION,
   manifest: "/manifest.json",
   appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: APP_DEFAULT_TITLE,
   },
   formatDetection: {
      telephone: false,
   },
   openGraph: {
      type: "website",
      siteName: APP_NAME,
      title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
      },
      description: APP_DESCRIPTION,
   },
   twitter: {
      card: "summary",
      title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
      },
      description: APP_DESCRIPTION,
   },
};



export default async function LocaleLayout({children}: {children: React.ReactNode}) {
   const locale = await getLocale();
   const messages = await getMessages();


   return (
      <html lang={locale} suppressHydrationWarning>
         <head>
            <meta name="viewport" content="width=1280" />
            <meta name="application-name" content="TTRPG Character Manager" />
            <meta name="format-detection" content="telephone=no" />
            <meta name="theme-color" content="#09090b" />

            <link rel="manifest" href="/manifest.json" />
         </head>
         <body className={inter.className}>
            <ThemeProvider
               attribute="class"
               defaultTheme="system"
               enableSystem
               disableTransitionOnChange
            >
               <NextIntlClientProvider locale={locale} messages={messages}>


                  <ThemeClassManager>
                     <AppStartManagerProvider>
                        {children}
                     </AppStartManagerProvider>
                  </ThemeClassManager>
                  
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


               </NextIntlClientProvider>
            </ThemeProvider>
         </body>
      </html>
   );
}
