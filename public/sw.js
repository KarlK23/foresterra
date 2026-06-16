var CACHE = 'foresterra-v1';
var FILES = ['/', '/style.css', '/app.js', '/manifest.json'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(FILES);
    })
  );
});

self.addEventListener('fetch', function(e) {
  // Pour les API et uploads, toujours aller au réseau
  if (e.request.url.includes('/api/') || e.request.url.includes('/uploads/')) {
    return;
  }
  e.respondWith(
    fetch(e.request).catch(function() {
      return caches.match(e.request);
    })
  );
});
