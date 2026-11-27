"use client";
import {useState,type FormEvent} from "react";
type PixelFn=((...args:unknown[])=>void)&{callMethod?:(...args:unknown[])=>void;queue:unknown[][];loaded:boolean;version:string;push?:PixelFn};
function lead(pixelId:string){
 if(!pixelId)return;
 const w=window as Window&{fbq?:PixelFn;_fbq?:PixelFn};
 if(!w.fbq){
  const f=function(...args:unknown[]){if(f.callMethod)f.callMethod(...args);else f.queue.push(args)} as PixelFn;
  f.queue=[];f.loaded=true;f.version="2.0";f.push=f;w.fbq=f;w._fbq=f;
  const script=document.createElement("script");script.async=true;script.src="https://connect.facebook.net/en_US/fbevents.js";document.head.appendChild(script);
 }
 w.fbq("init",pixelId);w.fbq("track","Lead");
}
export default function WaitlistForm({pixelId}:{pixelId:string}){
 const [kind,setKind]=useState(""),[country,setCountry]=useState("MX"),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState(""),[copied,setCopied]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setBusy(true);setError("");
  const form=new FormData(event.currentTarget);
  const payload:Record<string,unknown>=Object.fromEntries(form);
  payload.privacy=form.has("privacy");payload.pixel_consent=form.has("pixel_consent");
  const params=new URLSearchParams(location.search);
  for(const key of ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","utm_id"])payload[key]=params.get(key)||"";
  try{
   const res=await fetch("/api/local/waitlist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const data=await res.json();
   if(!res.ok||!data.ok)throw new Error(data.error||"No se pudo guardar tu registro.");
   setDone(true);
   if(data.created&&payload.pixel_consent)try{lead(pixelId)}catch{/* La medición nunca invalida el registro. */}
  }catch(e){setError(e instanceof Error?e.message:"Inténtalo de nuevo.")}finally{setBusy(false)}
 }
 async function share(){
  const url=location.origin+"/lista?utm_source=referral&utm_medium=share&utm_campaign=lista_espera";
  const text="¡Únete a la lista de espera de Kreyvi!";
  if(navigator.share){try{await navigator.share({title:"Kreyvi",text,url});return}catch(e){if(e instanceof DOMException&&e.name==="AbortError")return}}
  window.open("https://wa.me/?text="+encodeURIComponent(text+" "+url),"_blank","noopener,noreferrer");
 }
 async function copy(){
  try{await navigator.clipboard.writeText(location.origin+"/lista?utm_source=referral&utm_medium=share&utm_campaign=lista_espera");setCopied(true)}catch{setCopied(false)}
 }
 if(done)return <div className="waitlist-success" aria-live="polite"><span className="waitlist-check">✓</span><h1>¡Gracias por unirte!</h1><p>Ya formas parte de la lista de espera. Te avisaremos cuando Kreyvi llegue a tu ciudad.</p><button type="button" className="waitlist-primary" onClick={share}>Compartir con amigos</button><button type="button" className="waitlist-secondary" onClick={copy}>{copied?"Enlace copiado":"Copiar enlace"}</button></div>;
 return <><div className="waitlist-intro"><span>MUY PRONTO</span><h1>Tu próxima recompensa empieza aquí.</h1><p>Únete a la lista de espera y ayúdanos a llevar Kreyvi a tu ciudad.</p></div>
 <form className="waitlist-form" onSubmit={submit}>
 <label>Nombre<input name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Tu nombre"/></label>
 <label htmlFor="waitlist-phone">WhatsApp</label><div className="waitlist-phone"><select name="country" aria-label="País del WhatsApp" value={country} onChange={e=>setCountry(e.target.value)}><option value="MX">🇲🇽 +52</option><option value="ES">🇪🇸 +34</option></select><input id="waitlist-phone" name="whatsapp" required type="tel" autoComplete="tel-national" placeholder={country==="MX"?"55 1234 5678":"612 345 678"} maxLength={40}/></div>
 <label>Correo electrónico <small>(opcional)</small><input name="email" type="email" autoComplete="email" maxLength={254} placeholder="tu@correo.com"/></label>
 <label>Ciudad<input name="city" required minLength={2} maxLength={120} autoComplete="address-level2" placeholder="Ej. Tijuana, Madrid"/></label>
 <fieldset><legend>¿Eres usuario o tienes un negocio?</legend><div className="waitlist-choices"><label><input type="radio" name="kind" value="user" required checked={kind==="user"} onChange={()=>setKind("user")}/> Soy usuario</label><label><input type="radio" name="kind" value="business" required checked={kind==="business"} onChange={()=>setKind("business")}/> Tengo un negocio</label></div></fieldset>
 {kind==="business"&&<div className="waitlist-business"><label>Nombre del local<input name="business_name" required maxLength={120}/></label><label>Tipo de negocio<select name="business_type" required defaultValue=""><option value="" disabled>Selecciona una opción</option><option value="cafe">Café / cafetería</option><option value="restaurant">Restaurante</option><option value="other">Otro</option></select></label><label>Número de sucursales<input name="branches" type="number" min={1} max={10000} step={1} defaultValue={1} required/></label></div>}
 <div className="waitlist-trap" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off"/></div>
 <label className="waitlist-consent"><input name="privacy" type="checkbox" required/><span>Acepto el <a href="#waitlist-privacy">aviso de privacidad</a> y autorizo que Kreyvi me contacte por WhatsApp o correo sobre la lista de espera y el lanzamiento.</span></label>
 {pixelId&&<label className="waitlist-consent"><input name="pixel_consent" type="checkbox"/><span>Acepto la medición publicitaria de Meta (opcional).</span></label>}
 {error&&<p role="alert" className="waitlist-error">{error}</p>}
 <button type="submit" className="waitlist-primary" disabled={busy}>{busy?"Registrando…":"Unirme a la lista de espera"}</button>
 <details id="waitlist-privacy" className="waitlist-privacy"><summary>Aviso de privacidad de la lista de espera</summary><p>Kreyvi utiliza tus datos para gestionar tu inscripción, conocer la demanda por ciudad y tipo de participante y contactarte sobre el lanzamiento. Conservamos el origen de la visita mediante parámetros de campaña. Solo si lo autorizas, Meta puede recibir un evento de conversión y datos técnicos de navegación; no enviamos tu nombre, teléfono ni correo en el evento. Puedes solicitar acceso, corrección, eliminación o retirar tu consentimiento mediante <a href="/contacto" target="_blank" rel="noreferrer">nuestro formulario de contacto</a>.</p></details>
 </form></>;
}
