// -- Next Imports --
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import { cookies } from 'next/headers';



export default getRequestConfig(async ({requestLocale}) => {
   const cookieStore = await cookies();
   const savedLocale = cookieStore.get('NEXT_LOCALE')?.value;

   let locale = routing.defaultLocale;

   if (savedLocale && hasLocale(routing.locales, savedLocale)) {
      locale = savedLocale;
   }

   // Load the current locale's messages
   const messages = (await import(`../../messages/${locale}.json`)).default;

   // Load English messages as fallback (only if not already English and not in dev mode)
   const isDevelopment = process.env.NODE_ENV === 'development';
   let fallbackMessages = {};
   if (locale !== 'en' && !isDevelopment) {
      fallbackMessages = (await import(`../../messages/en.json`)).default;
   }

   return {
      locale,
      messages: {
         ...fallbackMessages,
         ...messages
      },
      getMessageFallback({ namespace, key, error }) {
         const path = [namespace, key].filter((part) => part != null).join('.');

         if (error.code === 'MISSING_MESSAGE') {
            return isDevelopment ? `MISSING: ${path}` : key;
         } else {
            return isDevelopment ? `ERROR: ${path}` : key;
         }
      }
   };
});