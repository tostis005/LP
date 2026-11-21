import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const read=path=>readFileSync(path,"utf8");
const form=read("components/BusinessOffersPanel.tsx");
const route=read("app/api/local/offers/route.ts");
const sw=read("public/sw.js");
const sender=read("lib/server/web-push.ts");
const login=read("app/acceder/page.tsx");
const frame=read("components/AppFrame.tsx");
const migration=read("db/migrations/320_offer_start_is_validity_not_send_time.sql");

assert.match(form,/<option value="notice">Enviar aviso<\/option>/);
assert.match(form,/<option value="offer">Crear oferta<\/option>/);
assert.doesNotMatch(form,/<option value="news">/);
assert.doesNotMatch(form,/Guardar borrador/);
assert.doesNotMatch(form,/Quedará pendiente de facturar/);
assert.match(form,/Precio total de la campaña/);
assert.match(form,/PRECIO TOTAL DE LA CAMPAÑA/);
assert.match(form,/action:"create_send"/);
assert.match(form,/await deliver\(created.id,created.campaigns\)/);
assert.match(route,/input.action==="create_send"/);
assert.match(route,/public.confirm_offer_campaign/);
assert.match(route,/return \{id,channels:prepared,campaigns:/);
assert.match(migration,/v_until<CURRENT_DATE/);
assert.doesNotMatch(migration,/v_from>CURRENT_DATE/);
assert.match(login,/setLoginTarget\(candidate\)/);
assert.match(frame,/acceder\?next=/);
assert.match(sender,/url:item.offer_id\?"\/app\/novedades\/"/);

const listeners={};
const events=[];
let focused=0;
const appOrigin="https://example.kreyv.test";
const id="123e4567-e89b-42d3-a456-426614174000";
const page="/app/novedades/"+id;
const registration={
 showNotification:async(title,opts)=>{events.push({title,opts});}
};
const worker={
 location:{origin:appOrigin},
 registration,
 addEventListener(name,fn){listeners[name]=fn;},
 clients:{
  matchAll:async()=>[],
  openWindow:async url=>{
   events.push({opened:url});
   return {focus:async()=>{focused++}};
  }
 }
};
vm.runInNewContext(sw,{self:worker,URL,console,caches:{}},{filename:"sw.js"});
assert.equal(typeof listeners.push,"function");
assert.equal(typeof listeners.notificationclick,"function");
let display;
listeners.push({
 data:{json:()=>({title:"Oferta Kreyv",body:"Consulta el detalle",url:page})},
 waitUntil(task){display=task}
});
await display;
assert.equal(events[0].opts.data.url,page);
assert.match(events[0].opts.icon,/kreyv-notification-icon-v2-192\.png/);
assert.match(events[0].opts.badge,/kreyv-notification-badge-v2-96\.png/);
let navigation,closed=false;
listeners.notificationclick({
 notification:{data:{url:page},close(){closed=true}},
 waitUntil(task){navigation=task}
});
await navigation;
assert.equal(closed,true);
assert.equal(events[1].opened,appOrigin+page,"La notificación debe abrir el detalle y no la portada");
assert.equal(focused,1);

console.log("OK: dos tipos, envío en una confirmación, precio limpio, logo Android y apertura directa del aviso.");
