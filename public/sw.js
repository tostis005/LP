/* KREYVI PWA: solo se guarda una página pública sin datos personales. */
const CACHE="kreyv-offline-v5";
const PUSH_ICON="/kreyv-notification-icon-v2-192.png";
const PUSH_BADGE="/kreyv-notification-badge-v2-96.png";
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(async cache=>{
  await cache.add("/offline");
  // Tener los símbolos de marca incluso cuando Chrome muestre una notificación sin la app abierta.
  await Promise.allSettled([cache.add(PUSH_ICON),cache.add(PUSH_BADGE)]);
 }).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith("loyally-offline-")||k.startsWith("kreyv-offline-"))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const path=new URL(event.request.url);
 if(path.origin===self.location.origin&&(path.pathname===PUSH_ICON||path.pathname===PUSH_BADGE)){
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
  return;
 }
 if(event.request.mode!=="navigate")return;
 event.respondWith(fetch(event.request).catch(()=>caches.match("/offline")));
});

/* Notificaciones Web Push: visibles incluso con la PWA cerrada. */
self.addEventListener("push",event=>{
 let data={};
 try{data=event.data?event.data.json():{}}catch{}
 const title=typeof data.title==="string"?data.title.slice(0,180):"KREYVI";
 const body=typeof data.body==="string"?data.body.slice(0,500):"Tienes novedades de tus negocios favoritos.";
 const url=typeof data.url==="string"&&data.url.startsWith("/")&&!data.url.startsWith("//")?data.url:"/app";
 const tag=typeof data.tag==="string"?data.tag:"kreyv";
 // Un fallo de decodificación de imágenes no debe impedir que llegue el aviso.
 const display=()=>self.registration.showNotification(title,{
  body,icon:new URL(PUSH_ICON,self.location.origin).href,
  badge:new URL(PUSH_BADGE,self.location.origin).href,
  tag,data:{url}
 }).catch(error=>{
  console.warn("Icono push no disponible; mostrando notificación de texto",error);
  return self.registration.showNotification(title,{body,tag,data:{url}});
 });
 event.waitUntil(display());
});
// Al tocar una notificación abre directamente su detalle; si ya hay una ventana
// abierta se prioriza la ruta solicitada, no una pantalla antigua en primer plano.
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const raw=event.notification.data?.url;
 const path=typeof raw==="string"&&raw.startsWith("/")&&!raw.startsWith("//")?raw:"/app/novedades";
 const target=new URL(path,self.location.origin);
 if(target.origin!==self.location.origin)return;
 event.waitUntil((async()=>{
  const tabs=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  const exact=tabs.find(client=>client.url===target.href);
  if(exact){await exact.focus();return;}
  // Chrome/Android puede abrir directamente la PWA instalada con esta ruta.
  try{
   const opened=await self.clients.openWindow(target.href);
   if(opened){await opened.focus();return;}
  }catch(error){console.warn("No se pudo abrir la vista del aviso",error);}
  // Alternativa para navegadores que bloquean openWindow o devuelven null.
  for(const client of tabs){
   if(new URL(client.url).origin!==target.origin)continue;
   try{
    const navigated=await client.navigate(target.href);
    if(navigated){await navigated.focus();return;}
   }catch(error){console.warn("No se pudo navegar la ventana existente",error);}
  }
  try{await self.clients.openWindow(target.href);}catch(error){
   console.error("No se pudo abrir el detalle de la notificación",error);
  }
 })());
});
