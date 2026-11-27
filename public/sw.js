/* KREYVI PWA: shell público y recursos estáticos; no se guardan respuestas privadas de API. */
const CACHE="kreyv-offline-v11";
const PUSH_ICON="/kreyv-notification-icon-v2-192.png";
const PUSH_BADGE="/kreyv-notification-badge-v2-96.png";
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(async cache=>{
  const shell=await fetch("/offline",{cache:"reload",credentials:"omit"});
  if(!shell.ok)throw Error("Offline shell");
  const html=await shell.clone().text();
  const paths=[...new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(p=>p.startsWith("/_next/static/")))];
  await cache.addAll(paths);
  await cache.put("/offline",shell);
  await Promise.allSettled(["/brand/kreyv-pegada-vino-mostaza-claro.svg","/brand/kreyv-pegada-vino-mostaza-oscuro.svg","/brand/kreyv-pegada-tinta-maiz-claro.svg","/brand/kreyv-pegada-tinta-maiz-oscuro.svg"].map(p=>cache.add(p)));
  // Tener los símbolos de marca incluso cuando Chrome muestre una notificación sin la app abierta.
  await Promise.allSettled([cache.add(PUSH_ICON),cache.add(PUSH_BADGE)]);
 }).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith("loyally-offline-")||k.startsWith("kreyv-offline-"))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("message",event=>{
 if(event.data?.type!=="WARM_CARD_ASSETS"||!Array.isArray(event.data.urls))return;
 event.waitUntil((async()=>{const cache=await caches.open(CACHE);
  await Promise.allSettled(event.data.urls.slice(0,150).map(async raw=>{
   if(typeof raw!=="string")return;const url=new URL(raw,self.location.origin);
   if(url.origin!==self.location.origin||!(url.pathname.startsWith("/api/assets/business-assets/")||url.pathname.startsWith("/brand/")))return;
   if(await cache.match(url.href))return;
   const response=await fetch(url.href,{credentials:"omit"});
   if(response.ok&&(url.pathname.startsWith("/brand/")||/public/i.test(response.headers.get("Cache-Control")||""))&&/^image\//.test(response.headers.get("Content-Type")||""))await cache.put(url.href,response);
  }));
 })());
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const path=new URL(event.request.url);
 if(path.origin===self.location.origin&&(path.pathname===PUSH_ICON||path.pathname===PUSH_BADGE)){
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
  return;
 }
 if(path.origin===self.location.origin&&(path.pathname.startsWith("/_next/static/")||path.pathname.startsWith("/brand/")||path.pathname.startsWith("/api/assets/business-assets/"))){
  event.respondWith((async()=>{const cache=await caches.open(CACHE);const saved=await cache.match(event.request);if(saved&&path.pathname.startsWith("/_next/static/"))return saved;try{const response=await fetch(event.request);if(!response.ok&&response.status>=500&&saved)return saved;if(response.ok&&(path.pathname.startsWith("/_next/static/")||/public/i.test(response.headers.get("Cache-Control")||"")||path.pathname.startsWith("/brand/")))await cache.put(event.request,response.clone());return response}catch{const cached=await cache.match(event.request);if(cached)return cached;return Response.error()}})());return;
 }
 if(event.request.mode!=="navigate"||path.origin!==self.location.origin)return;
 // Never change the customer URL to /offline; the cached shell is only a fallback.
 const privateSpace=path.pathname==="/entrar"||path.pathname==="/offline"||path.pathname==="/app"||path.pathname.startsWith("/app/")||path.pathname==="/empleado"||path.pathname.startsWith("/empleado/")||path.pathname.startsWith("/t/")||path.pathname.startsWith("/p/");
 if(!privateSpace)return;
 event.respondWith((async()=>{try{const response=await fetch(event.request,{cache:"no-store"});if(response.status<500)return response;}catch{}const shell=await caches.match("/offline");if(!shell)return Response.error();return new Response(shell.body,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});})());
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
