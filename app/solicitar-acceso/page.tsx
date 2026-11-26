"use client";
import {useState} from "react";
import Link from "next/link";
import {ArrowUpRight,CheckCircle2,Heart,Mail,Store,MapPin,ShieldCheck} from "lucide-react";
import {PublicHeader} from "@/components/PublicHeader";
export default function RequestAccess(){
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
 return <><PublicHeader/><main className="request-page"><div className="container request-grid">
  <section className="request-copy"><div className="request-kicker"><span aria-hidden="true"/> HABLEMOS DE TU NEGOCIO</div>
   <h1>Hagamos que tus clientes <em>quieran volver.</em></h1>
   <p>Cuéntanos qué quieres conseguir. Te ayudaremos a descubrir cómo Kreyvi puede encajar en tu negocio y a dar el primer paso con tu propio programa de recompensas.</p>
   <div className="request-benefits">
    <div><div className="request-benefit-icon"><Heart size={21}/></div><span><strong>Más visitas, más fidelidad</strong><small>Recompensa a tus clientes con tarjetas que llevan tu marca.</small></span></div>
    <div><div className="request-benefit-icon"><MapPin size={21}/></div><span><strong>Que te descubran</strong><small>Da visibilidad a tu negocio dentro de la comunidad local.</small></span></div>
    <div><div className="request-benefit-icon"><Store size={21}/></div><span><strong>Siempre a punto</strong><small>Registra compras y sellos sin conexión tras verificar tu sesión.</small></span></div>
   </div>
   <div className="request-note"><ShieldCheck size={21}/><span><strong>Hablemos sin compromiso.</strong><br/>Nuestro equipo revisará tu solicitud antes de activar tu negocio. No se realiza ningún cobro por solicitar acceso.</span></div>
   <Link className="request-app-link" href="/mi-loyally?instalar=1">¿Quieres conocer la app? <ArrowUpRight size={17}/></Link>
  </section>
  <section className="panel-card request-form">
  {sent?<div className="request-success"><CheckCircle2 size={48}/><h2>¡Solicitud recibida!</h2><p>Hemos registrado tus datos. La incorporación requiere revisión manual; este mensaje no implica que el negocio esté aprobado.</p><Link className="button button-dark" href="/">Volver a inicio <ArrowUpRight size={17}/></Link></div>:
  <><div className="request-form-heading"><div className="panel-icon"><Mail size={23}/></div><div><span className="request-form-kicker">TU PRIMER PASO</span><h2>Solicita acceso</h2></div></div><p className="muted">Déjanos tus datos y cuéntanos un poco sobre tu negocio.</p>
  <form className="form-stack" onSubmit={submit}><label>Nombre comercial<input required minLength={2} maxLength={120} value={business_name} onChange={e=>setBusiness(e.target.value)} placeholder="Ej. Café Noma"/></label>
   <label>Tu nombre<input required minLength={2} maxLength={120} value={contact_name} onChange={e=>setName(e.target.value)} placeholder="Nombre y apellidos"/></label>
   <label>Email de contacto<input required type="email" maxLength={254} value={contact_email} onChange={e=>setEmail(e.target.value)} placeholder="hola@minegocio.com"/></label>
   <div className="form-two"><label>Sector<select value={category} onChange={e=>setCategory(e.target.value)}>{["Cafetería","Restaurante","Barbería","Belleza","Tienda","Salud y bienestar","Otros"].map(c=><option key={c}>{c}</option>)}</select></label><label>Ciudad<input required minLength={2} maxLength={120} value={city} onChange={e=>setCity(e.target.value)} placeholder="Madrid"/></label></div>
   <label>¿Qué te gustaría conseguir? (opcional)<textarea rows={4} maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Nos gustaría fidelizar a nuestros clientes..."/></label>
   <div className="honeypot-field" aria-hidden="true"><label>Deja este campo vacío<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>
   <div className="check-control"><input type="checkbox" id="consent-access" required checked={consent_contact} onChange={e=>setConsent(e.target.checked)}/><label htmlFor="consent-access"><strong>Autorizo que Kreyvi me contacte sobre esta solicitud.</strong><small>No implica aceptar publicidad ni suscribirse a una lista de marketing. Solo utilizaremos estos datos para responder a la solicitud.</small></label></div>
   {error&&<div className="alert error" role="alert">{error}</div>}
   <button className="button button-dark button-full" disabled={busy}>{busy?"Enviando...":"Solicitar acceso"} <ArrowUpRight size={18}/></button>
   <p className="tiny-note">El acceso a la plataforma se concede manualmente. No se realiza ningún cobro al enviar esta solicitud.</p>
  </form></>}
  </section>
 </div></main></>;
}
