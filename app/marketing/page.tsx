"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {AdminCrm} from "@/components/AdminCrm";
import {KreyviLoading} from "@/components/KreyviLoading";
import {db} from "@/lib/supabase";
export default function Marketing(){const router=useRouter();const [state,setState]=useState("loading");useEffect(()=>{fetch("/api/local/admin/marketing-users?self=1",{cache:"no-store"}).then(async r=>{if(r.status===401){router.replace("/acceder");return;}if(!r.ok)throw Error();const v=await r.json();if(!v.marketing){router.replace("/entrar");return;}setState(v.active?"active":"disabled");}).catch(()=>setState("error"));},[router]);if(state==="loading")return <KreyviLoading label="Preparando CRM"/>;return <main style={{maxWidth:1600,margin:"auto",padding:"20px 16px"}}><div className="content-heading"><div><h1>Marketing · Kreyvi</h1><p className="muted">Tu espacio comercial</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Link className="button button-outline" href="/restablecer-clave">Cambiar contraseña</Link><button className="button button-outline" onClick={async()=>{await db().auth.signOut();router.replace("/acceder");}}>Cerrar sesión</button></div></div>{state==="active"?<AdminCrm marketingOnly/>:<p role="alert">{state==="disabled"?"Acceso desactivado.":"No se pudo comprobar el acceso."}</p>}</main>;}
