const CACHE_STATIC = 'ralabs-customer-static-v1';
const CACHE_API = 'ralabs-customer-api-v1';
const BASE_URL = new URL('./', self.registration.scope);

const STATIC_ASSETS = [
  '',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.svg',
  'icons/icon-512.svg',
].map((path) => new URL(path, BASE_URL).href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_STATIC && key !== CACHE_API)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Static shell: cache-first
  if (event.request.method === 'GET') {
    event.respondWith(cacheFirst(event.request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const network = await fetch(request);
    if (network.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, network.clone());
    }
    return network;
  } catch {
    return caches.match(new URL('index.html', BASE_URL).href);
  }
}

async function networkFirst(request) {
  try {
    const network = await fetch(request);
    if (network.ok) {
      const cache = await caches.open(CACHE_API);
      cache.put(request, network.clone());
    }
    return network;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: { code: 'OFFLINE', message: 'You are offline. Please check your connection.' } }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
