/* Loyally PWA: solo se guarda una página pública sin datos personales. */
const CACHE="loyally-offline-v1";
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.add("/offline")).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("loyally-offline-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET"||event.request.mode!=="navigate")return;
 event.respondWith(fetch(event.request).catch(()=>caches.match("/offline")));
});
