// Pentarch MediCore sales portal: keeps the app shell on the phone so it opens without network.
const CACHE = 'pp-shell-v1';
const SHELL = ['/portal', '/try', '/portal.webmanifest', '/pentarch-icon.svg', '/pentarch-icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const ours = u.origin === location.origin;
  if (ours && u.pathname.startsWith('/api/')) return; // data goes through the app's own offline store
  if (e.request.mode === 'navigate' && ours && (u.pathname.startsWith('/portal') || u.pathname.startsWith('/try'))) {
    const key = u.pathname.startsWith('/try') ? '/try' : '/portal';
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(key, c)); return r; }).catch(() => caches.match(key)));
    return;
  }
  const cacheable = (ours && (u.pathname.startsWith('/assets/') || u.pathname.startsWith('/pentarch-'))) || /fonts\.(googleapis|gstatic)\.com|pentarchcommunications\.com\/wp-content/.test(u.href);
  if (cacheable) e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })));
});
