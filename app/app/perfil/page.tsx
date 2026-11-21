"use client";
import {useEffect,useState} from "react";
import {CheckCircle2,UserRound} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {db} from "@/lib/supabase";
function Profile({account}:{account:Account}){
 const [name,setName]=useState(""),[email,setEmail]=useState(account.user.email||"");
 const [whatsapp,setWhatsapp]=useState(account.user.user_metadata?.whatsapp||"");
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let active=true;
  db().from("profiles").select("full_name").eq("id",account.user.id).maybeSingle()
   .then(({data})=>{if(active)setName(data?.full_name||"")});
  return()=>{active=false};
 },[account.user.id]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMsg("");setError("");
  const {error:e1}=await db().from("profiles").update({full_name:name.trim()}).eq("id",account.user.id);
  const phoneChanged=whatsapp.trim()!==(account.user.user_metadata?.whatsapp||"");
  const ePhone=phoneChanged?await db().auth.updateUser({whatsapp:whatsapp.trim()}):null;
  const emailChanged=email.trim().toLowerCase()!==(account.user.email||"").toLowerCase();
  const e3=!ePhone?.error&&emailChanged?await db().auth.updateUser({email:email.trim()}):null;
  setBusy(false);
  if(e1||e3?.error||ePhone?.error)setError(e1?.message||ePhone?.error?.message||e3?.error?.message||"No se pudieron guardar los datos.");
  else setMsg(emailChanged?"Datos guardados. Confirma el nuevo correo desde el enlace que recibirás.":"Datos guardados correctamente.");
 }
 return <form className="panel-card customer-profile-only" onSubmit={save}>
  <div className="panel-icon"><UserRound size={22}/></div><h2>Mi información</h2>
  <div className="form-stack">
   <label>Nombre completo<input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" required/></label>
   <label>Correo electrónico<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>WhatsApp (opcional)<input type="tel" inputMode="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="+526641234567" pattern="[+][1-9][0-9]{7,14}"/><small>Incluye el prefijo del país para recibir mensajes.</small></label>
   {msg&&<div className="alert success"><CheckCircle2 size={17}/>{msg}</div>}
   {error&&<div className="alert error">{error}</div>}
   <button disabled={busy} type="submit" className="button button-dark">{busy?"Guardando...":"Guardar cambios"}</button>
  </div>
 </form>;
}
export default function ProfilePage(){return <AppFrame area="customer" title="Mi perfil" subtitle="Tu información personal.">{a=><Profile account={a}/>}</AppFrame>}
