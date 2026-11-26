"use client";
import {useState} from "react";
import {ArrowUpRight,CheckCircle2} from "lucide-react";
const topics=[["wallet","Google Wallet","Google Wallet"],["card","Mi tarjeta o código QR","My card or QR code"],["account","Acceso a mi cuenta","Account access"],["rewards","Sellos y recompensas","Stamps and rewards"],["privacy","Privacidad y preferencias","Privacy and preferences"],["other","Otra consulta","Other question"]];
export function SupportForm({lang}:{lang:"es"|"en"}){
 const en=lang==="en",[busy,setBusy]=useState(false),[error,setError]=useState(""),[received,setReceived]=useState(false),[reference,setReference]=useState("");
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const data=Object.fromEntries(new FormData(e.currentTarget));try{
  const r=await fetch("/api/support",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...data,consent:data.consent==="on"})});const j=await r.json();if(!r.ok||!j.ok)throw Error(en?"We could not submit your request. Please try again.":j.error||"No se ha podido enviar tu consulta.");setReference(j.id||"");setReceived(true);
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel-card help-form" id="contact" aria-labelledby="support-form-title">{received?<div role="status"><CheckCircle2 size={38}/><h2>{en?"Request received":"Consulta recibida"}</h2><p>{en?"Our support team can review your request and reply to the email you provided.":"Nuestro equipo podrá revisar tu consulta y responder al correo que nos has indicado."}</p>{reference&&<p><small>{en?"Reference":"Referencia"}: {reference}</small></p>}<button className="button button-outline" onClick={()=>setReceived(false)}>{en?"Send another request":"Enviar otra consulta"}</button></div>:<>
 <h2 id="support-form-title">{en?"Contact Kreyvi support":"Contacta con soporte"}</h2><p>{en?"No account or sign-in is required.":"No necesitas tener una cuenta ni iniciar sesión."}</p>
 <form className="form-stack" onSubmit={submit}>
 <label>{en?"Name":"Nombre"}<input name="name" required minLength={2} maxLength={120} autoComplete="name"/></label>
 <label>{en?"Email address":"Correo electrónico"}<input name="email" type="email" required maxLength={254} autoComplete="email"/></label>
 <label>{en?"What do you need help with?":"¿En qué podemos ayudarte?"}<select name="topic">{topics.map(([v,es,english])=><option key={v} value={v}>{en?english:es}</option>)}</select></label>
 <label>{en?"Describe the problem, including the business name if relevant.":"Describe el problema. Indica el negocio si procede."}<textarea name="message" required minLength={10} maxLength={2000} rows={5}/></label>
 <p className="tiny-note">{en?"Do not include passwords, verification codes, payment details or private QR codes.":"No incluyas contraseñas, códigos de verificación, datos de pago ni códigos QR privados."}</p>
 <div className="honeypot-field" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
 <label className="help-consent"><input type="checkbox" name="consent" required/>{en?"I agree that Kreyvi may use these details to respond to this request. This does not subscribe me to marketing.":"Autorizo el uso de estos datos para responder a mi consulta. Esto no implica aceptar publicidad."}</label>
 {error&&<p className="alert error" role="alert">{error}</p>}
 <button className="button button-dark button-full" disabled={busy}>{busy?(en?"Sending…":"Enviando…"):(en?"Send request":"Enviar consulta")} <ArrowUpRight size={18}/></button>
 </form></>}</section>;
}
