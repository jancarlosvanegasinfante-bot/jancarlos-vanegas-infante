// Jansel Shop AI Service Worker
const CACHE_NAME = 'jansel-ai-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through all API / socket / firebase requests directly to network
  if (
    event.request.url.includes('/api/') || 
    event.request.method !== 'GET' ||
    event.request.url.includes('firestore.googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
