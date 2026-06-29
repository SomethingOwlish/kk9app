import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Deployed under the GitHub Pages subpath /kk9app/ — base, PWA scope and
// start_url must all agree on that prefix or the installed app 404s on launch.
export default defineConfig({
  base: '/kk9app/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Колледж Кощея',
        short_name: 'КК9',
        lang: 'ru',
        start_url: '/kk9app/',
        scope: '/kk9app/',
        display: 'standalone',
        background_color: '#1a1a1a',
        theme_color: '#1a1a1a',
        icons: [
          { src: '/kk9app/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/kk9app/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/kk9app/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Install-only offline: cache static build assets. Firestore manages
        // its own offline persistence and is not handled here.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
})
