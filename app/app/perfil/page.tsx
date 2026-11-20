"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {BellRing,CheckCircle2,Mail,ShieldCheck,UserRound} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {db} from "@/lib/supabase";
function Profile({account}:{account:Account}){
 const [name,setName]=useState(""),[email,setEmail]=useState(account.user.email||""),[whatsapp,setWhatsapp]=useState(account.user.user_metadata?.whatsapp||""),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[error,setError]=useState("");
 useEffect(()=>{async function load(){const [p,c]=await Promise.all([db().from("profiles").select("full_name").eq("id",account.user.id).maybeSingle(),db().from("marketing_consents").select("opted_in").eq("customer_id",account.user.id).is("business_id",null).maybeSingle()]);setName(p.data?.full_name||"");setConsent(!!c.data?.opted_in)}load()},[account.user.id]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMsg("");setError("");
  const {error:e1}=await db().from("profiles").update({full_name:name.trim()}).eq("id",account.user.id);
  const {error:e2}=await db().rpc("platform_upsert_consent",{p_opted_in:consent});
  const phoneChanged=whatsapp.trim()!==(account.user.user_metadata?.whatsapp||"");
  const ePhone=phoneChanged?await db().auth.updateUser({whatsapp:whatsapp.trim()}):null;
  const emailChanged=email.trim().toLowerCase()!==(account.user.email||"").toLowerCase();
  const e3=!ePhone?.error&&emailChanged?await db().auth.updateUser({email:email.trim()}):null;
  setBusy(false);if(e1||e2||e3?.error||ePhone?.error)setError(e1?.message||e2?.message||ePhone?.error?.message||e3?.error?.message||"Error");
  else setMsg(emailChanged?"Datos actualizados. Confirma el nuevo correo siguiendo el enlace que recibirás.":"Preferencias actualizadas correctamente.");
 }
 return <div className="settings-grid"><form className="panel-card" onSubmit={save}><div className="panel-icon"><UserRound size={22}/></div><h2>Tu información</h2><p className="muted">Tus datos se utilizan para gestionar las tarjetas y recompensas.</p><div className="form-stack"><label>Nombre completo<input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" required/></label><label>Correo electrónico<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/><small>Si cambias el correo, tendrás que confirmar el nuevo.</small></label><label>WhatsApp (opcional)<input type="tel" inputMode="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="+526641234567" pattern="\\+[1-9][0-9]{7,14}"/><small>Incluye el prefijo del país. Solo recibirás campañas si aceptas por separado las de un negocio. Cambiar tu número revoca los consentimientos anteriores.</small></label><div className="check-control"><input id="marketing" type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><label htmlFor="marketing"><strong>Quiero recibir novedades de Kreyv</strong><small>Información sobre nuevos negocios y ofertas de la plataforma. Puedes cancelar cuando quieras. El marketing de cada negocio se acepta por separado.</small></label></div>
 {msg&&<div className="alert success"><CheckCircle2 size={17}/>{msg}</div>}{error&&<div className="alert error">{error}</div>}<button disabled={busy} type="submit" className="button button-dark">Guardar cambios</button></div></form>
 <div className="panel-card profile-security"><div className="panel-icon"><BellRing size={22}/></div><h2>Notificaciones del teléfono</h2><p>Activa las notificaciones push y decide qué negocios pueden enviarte promociones.</p><Link href="/app/ajustes" className="button button-dark button-sm">Configurar notificaciones <BellRing size={16}/></Link><hr style={{border:0,borderTop:"1px solid #eadce4",margin:"24px 0"}}/><div className="panel-icon lilac"><ShieldCheck size={22}/></div><h2>Tu privacidad importa</h2><p>Tu ubicación solo se utiliza para buscar negocios si das permiso al navegador. Nunca es necesaria para usar tus tarjetas.</p><div className="privacy-item"><Mail size={18}/> El consentimiento de cada negocio es independiente.</div><div className="privacy-item"><ShieldCheck size={18}/> Tus movimientos solo los ven el negocio correspondiente y los administradores autorizados.</div><p className="tiny-note">Para ejercer tus derechos de acceso o supresión de datos, contacta con el responsable de la plataforma. Los flujos automatizados de borrado y exportación se completarán antes del lanzamiento público.</p></div>
 </div>;
}
export default function ProfilePage(){return <AppFrame area="customer" title="Tu perfil" subtitle="Un pequeño espacio para ti, tus datos y tus preferencias.">{a=><Profile account={a}/>}</AppFrame>}
