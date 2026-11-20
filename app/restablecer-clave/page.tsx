"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowRight,CheckCircle2,Eye,EyeOff,KeyRound} from "lucide-react";
import {Brand} from "@/components/Brand";
import {configured,db} from "@/lib/supabase";

export default function ResetPasswordPage(){
 const router=useRouter();
 const [verified,setVerified]=useState(false),[password,setPassword]=useState(""),[again,setAgain]=useState(""),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(false);
 useEffect(()=>{let alive=true;
  async function check(){
   if(!configured()){if(alive)setError("No se ha podido conectar con el servidor.");return}
   const {data}=await db().auth.getUser();
   if(alive){setVerified(!!data.user);if(!data.user)setError("El enlace es inválido o ha caducado. Solicita otro correo de recuperación.")}
  }check();return()=>{alive=false}
 },[]);
 async function save(e:React.FormEvent){
  e.preventDefault();setError("");
  if(password.length<10){setError("La nueva contraseña debe tener al menos 10 caracteres.");return}
  if(password!==again){setError("Las contraseñas no coinciden.");return}
  setBusy(true);
  const {error}=await db().auth.updateUser({password});
  setBusy(false);
  if(error){setError(error.message);return}
  setSuccess(true);
 }
 return <div className="recovery-page"><div className="recovery-header"><Brand/></div>
 <main className="recovery-card"><div className="panel-icon"><KeyRound size={22}/></div>
  {success?<><CheckCircle2 size={37} color="#8a3f59"/><h1>Contraseña actualizada</h1><p>Ya puedes continuar utilizando Kreyv.</p>
   <button className="button button-dark button-full" onClick={()=>router.replace("/entrar")}>Ir a mi espacio <ArrowRight size={17}/></button></>:
   <><div className="eyebrow">SEGURIDAD DE TU CUENTA</div><h1>Elige una nueva contraseña.</h1><p>Por seguridad, utiliza una contraseña que no hayas usado anteriormente.</p>
   <form className="form-stack" onSubmit={save}><label>Nueva contraseña<div className="password-input"><input required minLength={10} type={visible?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="Mínimo 10 caracteres"/><button type="button" aria-label="Mostrar contraseña" onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
   <label>Repite la contraseña<input required minLength={10} type={visible?"text":"password"} value={again} onChange={e=>setAgain(e.target.value)} autoComplete="new-password" placeholder="Repite tu nueva contraseña"/></label>
   {error&&<div className="alert error" role="alert">{error}</div>}
   <button disabled={!verified||busy} className="button button-dark button-full">{busy?"Actualizando...":"Guardar nueva contraseña"} <ArrowRight size={17}/></button></form>
   <Link className="text-link recovery-return" href="/acceder">Volver al acceso</Link></>}
 </main></div>;

}
