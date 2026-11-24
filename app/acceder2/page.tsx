"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowRight,CheckCircle2,ShieldCheck,Store,ScanLine,UserRound} from "lucide-react";
import {Brand} from "@/components/Brand";

const profiles=[
 {role:"ADMIN",name:"Administrador",detail:"Negocios, usuarios y reportes",icon:ShieldCheck},
 {role:"BUSINESS",name:"Dueño de negocio",detail:"Tarjetas, clientes y equipo",icon:Store},
 {role:"STAFF",name:"Empleado",detail:"Escanear tarjetas y asignar sellos",icon:ScanLine},
 {role:"CUSTOMER",name:"Cliente",detail:"Mis tarjetas y recompensas",icon:UserRound}
] as const;

export default function ManagementAccess(){
 const [qaEnabled,setQaEnabled]=useState(false),[qaAuthorized,setQaAuthorized]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let active=true;
  fetch("/api/local/qa-access",{credentials:"same-origin",cache:"no-store"})
   .then(r=>r.ok?r.json():null).then(v=>{
    if(active&&v){setQaEnabled(v.enabled===true);setQaAuthorized(v.authorized===true);}
   }).catch(()=>{}).finally(()=>{if(active)setLoaded(true)});
  return()=>{active=false};
 },[]);
 async function selectProfile(role:typeof profiles[number]["role"]){
  setBusy(true);setError("");setMessage("");
  try{
   const r=await fetch("/api/local/qa-access",{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({action:qaAuthorized?"switch":"request",role})});
   const v=await r.json() as {error?:string;route?:string;sent?:boolean};
   if(!r.ok)throw new Error(v.error||"No se pudo acceder con este perfil.");
   if(v.route){window.location.assign(v.route);return}
   if(v.sent){setMessage("Hemos enviado un enlace de acceso al correo de administración. Ábrelo para entrar. Después podrás cambiar entre perfiles con un clic.");return}
   throw new Error("No se pudo preparar el acceso.");
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }

 return <main className="recovery-page qa-management-page">
  <header className="recovery-header"><Brand/></header>
  <section className="recovery-card qa-management-card">
   <div className="eyebrow">ACCESO DE GESTIÓN</div>
   <h1>Selecciona un perfil</h1>
   <p>Acceso autorizado para gestionar y presentar Kreyvi.</p>
   {!loaded&&<p role="status">Comprobando disponibilidad…</p>}
   {loaded&&!qaEnabled&&<div className="alert error" role="alert">El acceso rápido no está disponible.</div>}
   {error&&<div className="alert error" role="alert">{error}</div>}
   {message&&<div className="alert success" role="status"><CheckCircle2 size={18}/>{message}</div>}
    {qaEnabled&&<section className="qa-profile-access">

     <p className="muted">{qaAuthorized?"Selecciona el perfil que quieres revisar.":"La primera vez confirmaremos el acceso desde tu correo de administración."}</p>
     <div className="auth-profile-grid auth-real-routes" role="group" aria-label="Acceso autorizado por perfil">
      {profiles.map(p=><button type="button" key={p.role} disabled={busy} className="auth-profile-card" onClick={()=>void selectProfile(p.role)}>
       <span className="auth-profile-icon"><p.icon size={23} strokeWidth={1.9}/></span>
       <span className="auth-profile-copy"><strong>{p.name}</strong><small>{p.detail}</small></span>
       <ArrowRight className="auth-profile-arrow" size={17}/>
      </button>)}
     </div>
    </section>}
   <Link className="text-link recovery-return" href="/acceder">Iniciar sesión con mi cuenta</Link>
  </section>
 </main>;
}
