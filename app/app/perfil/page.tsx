"use client";
import {InternationalPhoneInput} from "@/components/InternationalPhoneInput";
import {useEffect,useState} from "react";
import {CheckCircle2,UserRound,LogOut} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {db} from "@/lib/supabase";
function Profile({account}:{account:Account}){
 const [birthDate,setBirthDate]=useState(""),[gender,setGender]=useState(""),[ready,setReady]=useState(false);
 const [name,setName]=useState(""),[email,setEmail]=useState(account.user.email||"");
 const [whatsapp,setWhatsapp]=useState(account.user.user_metadata?.whatsapp||"");
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let active=true;
  db().from("profiles").select("full_name,birth_date,gender").eq("id",account.user.id).maybeSingle()
   .then(({data,error})=>{if(active){if(error){setError(error.message);return}setName(data?.full_name||"");setBirthDate(String(data?.birth_date||"").slice(0,10));setGender(data?.gender||"");setReady(true)}});
  return()=>{active=false};
 },[account.user.id]);
 async function save(e:React.FormEvent){e.preventDefault();if(!ready||!birthDate||birthDate<"1900-01-01"||birthDate>new Date().toISOString().slice(0,10)){setError("Indica una fecha de nacimiento válida.");return}setBusy(true);setMsg("");setError("");
  const {error:e1,count}=await db().from("profiles").update({full_name:name.trim(),birth_date:birthDate,gender:gender||null}).eq("id",account.user.id);
  if(e1||count!==1){setBusy(false);setError(e1?.message||"No se pudieron guardar los datos.");return}
  const phoneChanged=whatsapp.trim()!==(account.user.user_metadata?.whatsapp||"");
  const ePhone=phoneChanged?await db().auth.updateUser({whatsapp:whatsapp.trim()}):null;
  const emailChanged=email.trim().toLowerCase()!==(account.user.email||"").toLowerCase();
  const e3=!ePhone?.error&&emailChanged?await db().auth.updateUser({email:email.trim()}):null;
  setBusy(false);
  if(e3?.error||ePhone?.error)setError(ePhone?.error?.message||e3?.error?.message||"No se pudieron guardar los datos.");
  else setMsg(emailChanged?"Datos guardados. Confirma el nuevo correo desde el enlace que recibirás.":"Datos guardados correctamente.");
 }
 return <form className="panel-card customer-profile-only" onSubmit={save}>
  <div className="panel-icon"><UserRound size={22}/></div><h2>Mi información</h2>
  <div className="form-stack">
   <label>Nombre completo<input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" required/></label>
   <label>Fecha de nacimiento<input type="date" required min="1900-01-01" max={new Date().toISOString().slice(0,10)} value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></label>
   <label>Género (opcional)<select value={gender} onChange={e=>setGender(e.target.value)}><option value="">Prefiero no indicarlo</option><option value="man">Hombre</option><option value="woman">Mujer</option><option value="other">Otro</option></select></label>
   <label>Correo electrónico<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <InternationalPhoneInput label="Teléfono (opcional)" value={whatsapp} onChange={setWhatsapp}/>
   {msg&&<div className="alert success"><CheckCircle2 size={17}/>{msg}</div>}
   {error&&<div className="alert error">{error}</div>}
   <button disabled={busy||!ready} type="submit" className="button button-dark">{busy?"Guardando...":"Guardar cambios"}</button>
   <button type="button" className="customer-logout-button" onClick={async()=>{if(!window.confirm("¿Quieres cerrar tu sesión en KREYVI?"))return;await db().auth.signOut();window.location.assign("/acceder")}}><LogOut size={17}/> Cerrar sesión</button>
  </div>
 </form>;
}
export default function ProfilePage(){return <AppFrame area="customer" title="Mi perfil" subtitle="Tu información personal.">{a=><Profile account={a}/>}</AppFrame>}
