/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
   /** Set to "true" only on the dev-preview build; gates the unstable-build warning. Inlined at build time. */
   readonly VITE_DEV_PREVIEW?: string;
}
