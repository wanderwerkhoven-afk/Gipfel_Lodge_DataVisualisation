const CACHE_NAME = "gipfel-lodge-v1";

// Bestanden die we direct bij installatie willen cachen
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./site.webmanifest",
  "./CSS/style.css",
  "./JS/ui.js",
  "./assets/logo/favicon-96x96.png",
  "./assets/logo/web-app-manifest-192x192.png",
  "./assets/logo/web-app-manifest-512x512.png"
];

// URLs van externe libraries die we ook willen cachen
const EXTERNAL_LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"
];

// Install event: cache de precache assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Installing Service Worker, caching precache assets...");
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event: ruim oude caches op
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Cache-First strategy voor statische assets en libs
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // We cachen alleen GET requests
  if (request.method !== "GET") return;

  // Voor lokale bestanden of bekende external libs gebruiken we Cache-First
  const isLocal = url.origin === self.location.origin;
  const isLib = EXTERNAL_LIBS.some(libUrl => request.url.startsWith(libUrl)) || 
                request.url.includes("cdnjs.cloudflare.com") || 
                request.url.includes("cdn.jsdelivr.net/npm");

  if (isLocal || isLib) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Als het niet in de cache zit, haal het op en cache het direct
        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic" && networkResponse.type !== "cors") {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        }).catch(() => {
            // Fallback voor offline als we het bestand niet hebben
            if (request.mode === "navigate") {
                return caches.match("./index.html");
            }
        });
      })
    );
  }
});
