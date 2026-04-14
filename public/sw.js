const CACHE_NAME = 'jjl-1776131657444';

self.addEventListener('install', (event) => {
  // Skip waiting immediately — don't cache static assets (network-first)
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete ALL old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
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

// Network-first for everything — always serve fresh content
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => new Response('Offline', { status: 503 }))
  );
});
