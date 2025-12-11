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
   
   return {
      locale,
      messages: (await import(`../../messages/${locale}.json`)).default
   };
});