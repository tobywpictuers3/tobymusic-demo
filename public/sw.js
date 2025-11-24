// Service Worker v1.0.2 - Network-first, minimal caching
const SW_VERSION = 'v1.0.2';
const CACHE_NAME = `sonata-sw-${SW_VERSION}`;

// Install: activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log(`[SW ${SW_VERSION}] Installed`);
});

// Activate: clean old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete all caches except current
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log(`[SW] Deleting old cache: ${name}`);
              return caches.delete(name);
            })
        );
      }),
      // Take control of all clients immediately
      clients.claim()
    ])
  );
  console.log(`[SW ${SW_VERSION}] Activated`);
});

// Fetch: Network-first strategy (no HTML/JS/CSS caching)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // For navigation requests and API calls, always use network
  if (request.mode === 'navigate' || request.url.includes('/api/') || request.url.includes('workers.dev')) {
    event.respondWith(fetch(request));
    return;
  }
  
  // For other resources: network first, cache as fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        // Clone and cache successful responses
        if (response.ok && request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache only if network fails
        return caches.match(request).then(cached => {
          return cached || new Response('אין חיבור לאינטרנט', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});
