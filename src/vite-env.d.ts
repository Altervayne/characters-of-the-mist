/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
   /**
    * Old-domain "we've moved" banner switch. Set to the string 'true' on the frozen old-domain deployment
    * to show it; absent (the default) keeps the banner dormant, so the 2.0 update can ship to the current
    * domain before the migration push begins.
    */
   readonly VITE_SHOW_OLD_DOMAIN_BANNER?: string;
}
