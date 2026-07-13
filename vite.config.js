import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

// iOS 16.0–16.3 WebKit cannot parse regex lookbehind `(?<=…)` (added in Safari
// 16.4). `remark-gfm`'s autolink-literal ships exactly one such regex to match
// bare emails, so on those devices the whole bundle throws a SyntaxError at
// parse time → blank white screen in every iOS browser (all use WebKit).
// The lookbehind is redundant: mdast-util-gfm-autolink-literal already re-checks
// the preceding character in JS (`previous(match, true)`), so stripping the
// zero-width assertion preserves behavior while restoring iOS <16.4 support.
// Matches the autolink-literal lookbehind whether the bundler emits it as a
// regex literal `(?<=^|\s|\p{P}|\p{S})` or, when a legacy target triggers regex
// lowering, as a `new RegExp` string `(?<=^|\\s|\\p{P}|\\p{S})` — hence `\\+`.
const IOS16_LOOKBEHIND = /\(\?<=\^\|\\+s\|\\+p\{P\}\|\\+p\{S\}\)/g
function stripLookbehindForIos16() {
  return {
    name: 'strip-gfm-lookbehind-for-ios16',
    renderChunk(code) {
      if (!IOS16_LOOKBEHIND.test(code)) return null
      return { code: code.replace(IOS16_LOOKBEHIND, ''), map: null }
    },
  }
}

// Deployed under the GitHub Pages subpath /kk9app/ — base, PWA scope and
// start_url must all agree on that prefix or the installed app 404s on launch.
export default defineConfig({
  base: '/kk9app/',
  // Keep older iOS Safari a first-class target so modern syntax gets downleveled.
  build: { target: ['es2020', 'safari16'] },
  plugins: [stripLookbehindForIos16(), react(), VitePWA({
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
  }), cloudflare()],
})