import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/postcss'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  css: {
    postcss: {
      plugins: [
        tailwindcss()
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  plugins: [
    react(),
    tsconfigPaths(),
    VitePWA({
      // `prompt` (not `autoUpdate`): a freshly built service worker waits in the
      // background instead of taking over and reloading the page. The in-app
      // update banner (see `PWAUpdatePrompt`) lets the user apply it on their own
      // terms, or dismiss it and keep using the current version.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icons/**/*'],
      manifest: {
        name: 'Characters of the Mist',
        short_name: 'CotM',
        description: 'A modern, privacy-first character sheet manager for City of Mist, Otherscape, and Legend in the Mist TTRPGs.',
        id: '/',
        start_url: '/',
        scope: '/',
        // `standalone` drops the browser chrome so an installed instance uses the
        // full device screen like a native app.
        display: 'standalone',
        orientation: 'any',
        // Dark splash/status-bar tint so the cream app logo stays legible.
        theme_color: '#020817',
        background_color: '#020817',
        // The icons are full-bleed dark tiles with the cream logo centred inside
        // the maskable safe zone, so each doubles as an adaptive (`maskable`)
        // icon - Android renders the logo on the brand tile instead of dropping
        // a transparent icon onto a white plate.
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/icon-256x256.png',
            sizes: '256x256',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Precache the built app shell so it loads with no network. The large
        // single JS chunk sits just under Workbox's 2 MiB default cache limit.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // SPA fallback: any offline navigation resolves to the cached shell so
        // client-side routes keep working without a server round-trip.
        navigateFallback: 'index.html',
        // Drop precaches from previous deployments once the new SW activates.
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Google Fonts stylesheet: revalidate in the background so updated
            // font definitions are picked up while staying available offline.
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets'
            }
          },
          {
            // Google Fonts files: immutable and hashed, so cache-first with a
            // long expiry keeps the Inter typeface available offline.
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173
  }
})
