// -- Next Imports --
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'react-i18next';
import { routing } from './routing';
import { cookies } from 'next/headers';

// Deep merge utility for nested objects
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
   const output = { ...target };

   if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
         if (isObject(source[key])) {
            if (!(key in target)) {
               output[key] = source[key];
            } else {
               output[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
            }
         } else {
            output[key] = source[key];
         }
      });
   }

   return output;
}

function isObject(item: unknown): item is Record<string, unknown> {
   return !!item && typeof item === 'object' && !Array.isArray(item);
}



export default getRequestConfig(async () => {
   const cookieStore = await cookies();
   const savedLocale = cookieStore.get('NEXT_LOCALE')?.value;

   let locale = routing.defaultLocale;

   if (savedLocale && hasLocale(routing.locales, savedLocale)) {
      locale = savedLocale;
   }

   const messages = (await import(`../../messages/${locale}.json`)).default;

   let finalMessages = messages;
   const isDevelopment = process.env.VERCEL_ENV === 'development' || process.env.NODE_ENV === 'development';
   if (locale !== 'en' && !isDevelopment) {
      const englishMessages = (await import(`../../messages/en.json`)).default;
      finalMessages = deepMerge(englishMessages, messages);
   }

   return {
      locale,
      messages: finalMessages,
      getMessageFallback({ namespace, key }) {
         const path = [namespace, key].filter((part) => part != null).join('.');
         return `[${path}]`;
      }
   };
});