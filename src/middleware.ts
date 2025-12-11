// -- Next Imports --
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
 


const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
   const savedLocale = request.cookies.get('NEXT_LOCALE')?.value;
   const pathname = request.nextUrl.pathname;
   
   const pathnameLocale = routing.locales.find(
      locale => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
   );

   const isValidLocale = (locale: string): locale is 'en' | 'fr' => {
      return routing.locales.includes(locale as 'en' | 'fr');
   };

   if (savedLocale && isValidLocale(savedLocale) && savedLocale !== pathnameLocale) {
      const newPathname = pathnameLocale 
         ? pathname.replace(`/${pathnameLocale}`, `/${savedLocale}`)
         : `/${savedLocale}${pathname}`;
      
      return NextResponse.redirect(new URL(newPathname, request.url));
   }
   
   return intlMiddleware(request);
}
 
export const config = {
   matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};