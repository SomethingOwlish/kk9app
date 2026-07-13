// Self-destroying service worker.
//
// The old KK9 PWA (Workbox, skipWaiting + clientsClaim) registered a worker at
// this exact URL (/kk9app/sw.js, scope /kk9app/) and precached the whole app.
// After the move to Cloudflare, returning visitors were still served the cached
// app from this worker instead of the redirect stub. When the browser re-checks
// the worker script it now finds THIS file, which unregisters itself, deletes
// every cache, and reloads open tabs so they fetch the live stub from the server.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {
        /* ignore */
      }
      try {
        await self.registration.unregister();
      } catch (e) {
        /* ignore */
      }
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        try {
          client.navigate(client.url);
        } catch (e) {
          /* ignore */
        }
      }
    })()
  );
});
