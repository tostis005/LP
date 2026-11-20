/* Kreyv PWA: solo se guarda una página pública sin datos personales. */
const CACHE="kreyv-offline-v1";
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.add("/offline")).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith("loyally-offline-")||k.startsWith("kreyv-offline-"))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET"||event.request.mode!=="navigate")return;
 event.respondWith(fetch(event.request).catch(()=>caches.match("/offline")));
});

/* Notificaciones Web Push: visibles incluso con la PWA cerrada. */
self.addEventListener("push",event=>{
 let data={};
 try{data=event.data?event.data.json():{}}catch{}
 const title=typeof data.title==="string"?data.title.slice(0,180):"Kreyv";
 const body=typeof data.body==="string"?data.body.slice(0,500):"Tienes novedades de tus negocios favoritos.";
 const url=typeof data.url==="string"&&data.url.startsWith("/")&&!data.url.startsWith("//")?data.url:"/app";
 event.waitUntil(self.registration.showNotification(title,{
  body,icon:"/icon-192.png",badge:"/icon-192.png",
  tag:typeof data.tag==="string"?data.tag:"kreyv",
  data:{url}
 }));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const path=event.notification.data?.url||"/app";
 const target=new URL(path,self.location.origin);
 if(target.origin!==self.location.origin)return;
 event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(async clients=>{
  for(const client of clients){
   if(new URL(client.url).origin===target.origin){
    await client.navigate(target.href);
    return client.focus();
   }
  }
  return self.clients.openWindow(target.href);
 }));
});
