"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowRight,CheckCircle2,LockKeyhole} from "lucide-react";
import {Brand} from "@/components/Brand";

export default function ConfirmProfileAccess(){
 const [token,setToken]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{const url=new URL(window.location.href);setToken(url.searchParams.get("token")||"");window.history.replaceState(null,"",url.pathname);},[]);
 async function confirm(){
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/local/qa-access",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"verify",token})
   });
   const result=await r.json() as {error?:string;route?:string};
   if(!r.ok||!result.route)throw new Error(result.error||"No se pudo activar el acceso.");
   window.location.replace(result.route);
  }catch(e){setError((e as Error).message);setBusy(false);}
 }
 return <main className="recovery-page">
  <div className="recovery-header"><Brand/></div>
  <section className="recovery-card">
   <div className="panel-icon"><LockKeyhole size={25}/></div>
   <h1>Confirma el acceso</h1>
   <p>Vas a entrar con un perfil de Kreyv para revisar la aplicación. La autorización será temporal y podrás cambiar de perfil desde la pantalla de acceso.</p>
   {error&&<div className="alert error" role="alert">{error}</div>}
   <button type="button" className="button button-dark button-full" disabled={busy||!/^[a-f0-9]{64}$/.test(token)} onClick={()=>void confirm()}>
    {busy?"Comprobando...":"Confirmar acceso"} {busy?<CheckCircle2 size={17}/>:<ArrowRight size={17}/>}
   </button>
   <Link className="text-link" href="/acceder">Volver a iniciar sesión</Link>
  </section>
 </main>;
}
