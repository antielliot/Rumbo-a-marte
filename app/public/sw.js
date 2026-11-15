// Service worker de Mars Route: guarda la interfaz y los datos de Gale para abrirla sin red.
// Los mosaicos de NASA Trek y las consultas a DONKI son de otros dominios y nunca se guardan.
const CACHE = 'mars-route-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put('/index.html', c)); return r }).catch(() => caches.match('/index.html')))
    return
  }
  // /assets (con hash), /data (DEM, dunas, MCD, Curiosity) e iconos: primero la copia guardada
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)) }
    return r
  })))
})
