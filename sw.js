// Service worker Portal Hub: network-first agar pembaruan aplikasi selalu langsung terpakai.
// Panggilan /api/ tidak pernah disimpan. Cache hanya dipakai sebagai cadangan saat offline.
const VER = 'hub-sw-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== VER) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(u.pathname.startsWith('/fonts/') ? cacheFirst(r) : networkFirst(r));
});
async function networkFirst(r) {
  try {
    const res = await fetch(r);
    if (res.ok) (await caches.open(VER)).put(r, res.clone());
    return res;
  } catch (err) {
    const c = (await caches.match(r, { ignoreSearch: r.mode === 'navigate' })) || (r.mode === 'navigate' && (await caches.match('/')));
    if (c) return c;
    throw err;
  }
}
async function cacheFirst(r) {
  const c = await caches.match(r); if (c) return c;
  const res = await fetch(r); if (res.ok) (await caches.open(VER)).put(r, res.clone()); return res;
}
