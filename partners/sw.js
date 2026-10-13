const CACHE = 'ghadir-partners-portal-r7';
const SHELL = ['./', './portal.html', './logo.png', './manifest.webmanifest', './r7-ui.css', './r7-ui.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

async function portalResponse(request) {
  try {
    const response = await fetch(request);
    const url = new URL(request.url);
    const isPortal = url.pathname.endsWith('/partners/') || url.pathname.endsWith('/partners/portal.html');
    if (!isPortal || !response.ok || !(response.headers.get('content-type') || '').includes('text/html')) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return response;
    }

    let html = await response.text();
    const inject = '<link rel="stylesheet" href="./r7-ui.css?v=7.0.0"><script src="./r7-ui.js?v=7.0.0"><\/script>';
    if (!html.includes('r7-ui.js')) html = html.replace('</body>', inject + '</body>');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch (err) {
    return (await caches.match(request)) || (await caches.match('./portal.html')) || (await caches.match('./'));
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.includes('/api/')) return;
  event.respondWith(portalResponse(event.request));
});