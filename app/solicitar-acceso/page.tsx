"use client";
import {useState,useEffect} from "react";
import {LandingLanguageSync} from "@/components/LandingLanguageSync";
import {publicHref} from "@/lib/public-navigation";
import type {LandingLanguage} from "@/lib/landing-copy";
import {PUBLIC_BUSINESS_SECTORS} from "@/lib/public-business-sectors";
import Link from "next/link";
import {ArrowUpRight,CheckCircle2,Heart,Mail,Store,MapPin,ShieldCheck} from "lucide-react";
import {PublicHeader} from "@/components/PublicHeader";
import {PublicFooter} from "@/components/PublicFooter";
export default function RequestAccess(){
 const [lang,setLang]=useState<LandingLanguage>("es");
 useEffect(()=>{setLang(new URLSearchParams(window.location.search).get("lang")==="en"?"en":"es")},[]);
 const en=lang==="en";
 const [business_name,setBusiness]=useState(""),[contact_name,setName]=useState(""),[contact_email,setEmail]=useState(""),[category,setCategory]=useState("Cafetería"),[city,setCity]=useState(""),[message,setMessage]=useState(""),[consent_contact,setConsent]=useState(false),[website,setWebsite]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[sent,setSent]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setError("");setBusy(true);
  try{
   const res=await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    business_name,contact_name,contact_email,category,city,message,consent_contact,website
   })});
   const result=await res.json() as {ok?:boolean;error?:string};
   if(!res.ok||!result.ok)throw new Error(result.error||"No hemos podido registrar tu solicitud.");
   setSent(true);
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <><LandingLanguageSync lang={lang}/><PublicHeader lang={lang} page="contact"/><main className="request-page"><div className="container request-grid">
  <section className="request-copy"><div className="request-kicker"><span aria-hidden="true"/> {en?"LET’S TALK ABOUT YOUR BUSINESS":"HABLEMOS DE TU NEGOCIO"}</div>
   <h1>{en?"Give your customers ":"Hagamos que tus clientes "}<em>{en?"a reason to return.":"quieran volver."}</em></h1>
   <p>{en?"Tell us about your goals. We will help you see how Kreyvi fits your business and get started with your own rewards program.":"Cuéntanos qué quieres conseguir. Te ayudaremos a descubrir cómo Kreyvi puede encajar en tu negocio y a dar el primer paso con tu propio programa de recompensas."}</p>
   <div className="request-benefits">
    <div><div className="request-benefit-icon"><Heart size={21}/></div><span><strong>{en?"More visits, more loyalty":"Más visitas, más fidelidad"}</strong><small>{en?"Reward customers with cards that carry your brand.":"Recompensa a tus clientes con tarjetas que llevan tu marca."}</small></span></div>
    <div><div className="request-benefit-icon"><MapPin size={21}/></div><span><strong>{en?"Get discovered":"Que te descubran"}</strong><small>{en?"Give your business more visibility in the local community.":"Da visibilidad a tu negocio dentro de la comunidad local."}</small></span></div>
    <div><div className="request-benefit-icon"><Store size={21}/></div><span><strong>{en?"Always ready":"Siempre a punto"}</strong><small>{en?"Keep adding stamps, even when the internet goes down.":"Sigue sumando sellos a tus clientes, incluso si falla internet."}</small></span></div>
   </div>
   <div className="request-note"><ShieldCheck size={21}/><span><strong>{en?"Let's talk, no obligation.":"Hablemos sin compromiso."}</strong><br/>{en?"Our team will review your request before activating your business. There is no charge for requesting access.":"Nuestro equipo revisará tu solicitud antes de activar tu negocio. No se realiza ningún cobro por solicitar acceso."}</span></div>
   <Link className="request-app-link" href={publicHref("app",lang)}>{en?"Want to explore the app? ":"¿Quieres conocer la app? "}<ArrowUpRight size={17}/></Link>
  </section>
  <section className="panel-card request-form">
  {sent?<div className="request-success"><CheckCircle2 size={48}/><h2>{en?"Request received!":"¡Solicitud recibida!"}</h2><p>{en?"We have recorded your details. Onboarding requires manual review; this message does not mean that your business has been approved.":"Hemos registrado tus datos. La incorporación requiere revisión manual; este mensaje no implica que el negocio esté aprobado."}</p><Link className="button button-dark" href={publicHref("customer",lang)}>{en?"Back to home ":"Volver a inicio "}<ArrowUpRight size={17}/></Link></div>:
  <><div className="request-form-heading"><div className="panel-icon"><Mail size={23}/></div><div><span className="request-form-kicker">{en?"YOUR FIRST STEP":"TU PRIMER PASO"}</span><h2>{en?"Request access":"Solicita acceso"}</h2></div></div><p className="muted">{en?"Share your details and tell us a little about your business.":"Déjanos tus datos y cuéntanos un poco sobre tu negocio."}</p>
  <form className="form-stack" onSubmit={submit}><label>{en?"Business name":"Nombre comercial"}<input required minLength={2} maxLength={120} value={business_name} onChange={e=>setBusiness(e.target.value)} placeholder="Ej. Café Noma"/></label>
   <label>{en?"Your name":"Tu nombre"}<input required minLength={2} maxLength={120} value={contact_name} onChange={e=>setName(e.target.value)} placeholder={en?"Full name":"Nombre y apellidos"}/></label>
   <label>{en?"Contact email":"Email de contacto"}<input required type="email" maxLength={254} value={contact_email} onChange={e=>setEmail(e.target.value)} placeholder="hola@minegocio.com"/></label>
   <div className="form-two"><label>{en?"Industry":"Sector"}<select value={category} onChange={e=>setCategory(e.target.value)}>{PUBLIC_BUSINESS_SECTORS.map(c=><option key={c.value} value={c.value}>{en?c.en:c.value==="Tienda"?"Comercios y tiendas":c.value}</option>)}</select></label><label>{en?"City":"Ciudad"}<input required minLength={2} maxLength={120} value={city} onChange={e=>setCity(e.target.value)} placeholder="Madrid"/></label></div>
   <label>{en?"What would you like to achieve? (optional)":"¿Qué te gustaría conseguir? (opcional)"}<textarea rows={4} maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)} placeholder={en?"We would like to build customer loyalty…":"Nos gustaría fidelizar a nuestros clientes..."}/></label>
   <div className="honeypot-field" aria-hidden="true"><label>{en?"Leave this field empty":"Deja este campo vacío"}<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>
   <div className="check-control"><input type="checkbox" id="consent-access" required checked={consent_contact} onChange={e=>setConsent(e.target.checked)}/><label htmlFor="consent-access"><strong>{en?"I authorize Kreyvi to contact me about this request.":"Autorizo que Kreyvi me contacte sobre esta solicitud."}</strong><small>{en?"This does not subscribe you to marketing. We only use these details to respond to your request.":"No implica aceptar publicidad ni suscribirse a una lista de marketing. Solo utilizaremos estos datos para responder a la solicitud."}</small></label></div>
   {error&&<div className="alert error" role="alert">{error}</div>}
   <button className="button button-dark button-full" disabled={busy}>{busy?(en?"Sending…":"Enviando..."):(en?"Request access":"Solicitar acceso")} <ArrowUpRight size={18}/></button>
   <p className="tiny-note">{en?"Platform access is granted manually. Submitting this request does not incur a charge.":"El acceso a la plataforma se concede manualmente. No se realiza ningún cobro al enviar esta solicitud."}</p>
  </form></>}
  </section>
 </div></main><PublicFooter lang={lang} page="contact"/></>;
}
