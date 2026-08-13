// NOTE: CACHE_NAME is bumped on every build by scripts/build-sw.mjs so the
// browser detects an update → skipWaiting → controllerchange → client reload.
const CACHE_NAME = 'jjl-1786664801320';
// STATIC_CACHE tiene nombre FIJO a propósito. Los archivos de /_next/static/
// llevan un hash en el nombre: su contenido nunca cambia, así que no hace falta
// tirarlos en cada deploy. Cuando derivaba de CACHE_NAME, cada deploy vaciaba
// el cache y el alumno volvía a bajar ~2 MB de JavaScript — justo lo peor con
// señal mala. Los archivos viejos que ya nadie pide quedan en el cache sin
// molestar; el navegador los desaloja solo si necesita espacio.
const STATIC_CACHE = 'jjl-static-v1';
const RUNTIME_CACHE = `${CACHE_NAME}-runtime`;

// Minimal app shell that should survive offline.
const PRECACHE_URLS = [
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'JJL Elite';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/dashboard' },
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/)
  );
}

// Timeouts. En mobile con señal inestable un fetch NO falla: queda colgado
// indefinidamente. Sin timeout, el SW nunca resuelve la request y el usuario
// se queda con el spinner para siempre (la queja más común). Con timeout
// abortamos y caemos al cache / a una respuesta de error, que el cliente sí
// puede manejar.
const NAV_TIMEOUT_MS = 8000;    // navegación HTML — hay cache de respaldo
const API_TIMEOUT_MS = 12000;   // APIs — algunas tardan por cold start de Vercel
const ASSET_TIMEOUT_MS = 12000; // assets estáticos

function fetchWithTimeout(request, timeoutMs) {
  // AbortController corta el fetch colgado. Si el navegador no lo soporta,
  // degradamos a un fetch normal (mejor que romper).
  if (typeof AbortController === 'undefined') return fetch(request);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

async function networkFirst(request, runtime, timeoutMs = NAV_TIMEOUT_MS) {
  try {
    const response = await fetchWithTimeout(request, timeoutMs);
    if (response && response.ok && request.method === 'GET') {
      runtime.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (err) {
    // Incluye el abort por timeout: servimos cache si lo hay.
    const cached = await runtime.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cache) {
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetchWithTimeout(request, ASSET_TIMEOUT_MS);
  if (response && response.ok && request.method === 'GET') {
    cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

/**
 * Stale-while-revalidate: devolvemos lo que haya en cache INMEDIATAMENTE
 * (si existe) y lanzamos un fetch en background para actualizarlo. La
 * próxima carga ve el dato fresco. Es lo que hace que /modules cargue
 * instantáneo cuando ya lo visitaste antes.
 */
async function staleWhileRevalidate(request, cache) {
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok && request.method === 'GET') {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);
  if (cached) return cached;
  // Sin cache previo → esperar al network como network-first.
  const response = await networkPromise;
  if (response) return response;
  return new Response(JSON.stringify({ error: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

// IMPORTANTE — DESHABILITADO temporariamente.
//
// El SW cachea responses por URL sin tener en cuenta el header Cookie de
// la request. Cuando un usuario A se loguea y después se loguea el usuario
// B en el mismo browser (o un admin después de un alumno), el SW devuelve
// la respuesta vieja del usuario A → al admin le aparece todo como si
// fuera el alumno (sin menú admin, sin permisos correctos).
//
// El cache HTTP nativo del browser SÍ respeta `private` Cache-Control y
// no tiene este problema. Pero el SW lo pisa.
//
// Volvemos a network-only para todo /api/* hasta encontrar un esquema que
// incluya la identidad del user en la cache key.
const SWR_API_PATHS = [];

function isSwrCacheable() {
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API endpoints de SOLO LECTURA seguros → stale-while-revalidate. La
  // segunda navegación a /modules carga instantáneo desde cache mientras
  // SW pide al server en background.
  if (isSwrCacheable(url)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((runtime) =>
        staleWhileRevalidate(request, runtime),
      ),
    );
    return;
  }

  // Resto de /api/* → network only, sin cache. POSTs, admin sensible, etc.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      // Con timeout: si la API queda colgada devolvemos 503 y el cliente
      // muestra su estado de error en vez de girar para siempre.
      fetchWithTimeout(request, API_TIMEOUT_MS).catch(
        () =>
          new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );
    return;
  }

  // Static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) => cacheFirst(request, cache))
    );
    return;
  }

  // HTML navigations: network-first; fall back to cache, then /offline.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (runtime) => {
        try {
          return await networkFirst(request, runtime);
        } catch {
          const cached = await runtime.match(request);
          if (cached) return cached;
          const offline = await caches.match('/offline');
          if (offline) return offline;
          return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      })
    );
    return;
  }

  // Everything else: network-first with runtime cache fallback.
  event.respondWith(
    caches.open(RUNTIME_CACHE).then((runtime) =>
      networkFirst(request, runtime).catch(() => new Response('', { status: 503 }))
    )
  );
});
