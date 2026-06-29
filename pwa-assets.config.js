import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Generates favicon + PWA icons from the app logo (IMP-03 / FEAT-01).
// Run: `npx pwa-assets-generator`. Output lands next to the source image
// (src/media/). After generating, move/rename into public/ to match the
// manifest in vite.config.js:
//   pwa-192x192.png            -> public/icons/icon-192.png
//   pwa-512x512.png            -> public/icons/icon-512.png
//   apple-touch-icon-180x180   -> public/icons/apple-touch-icon.png
//   maskable-icon-512x512.png  -> public/icons/maskable-512.png
//   pwa-64x64.png              -> public/icons/icon-64.png
//   favicon.ico                -> public/favicon.ico
export default defineConfig({
  preset,
  images: ['src/media/logo.png'],
})
