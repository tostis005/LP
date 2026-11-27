"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {KeyRound,LogOut} from "lucide-react";
import {AdminCrm} from "@/components/AdminCrm";
import {CrmLoading,CrmLoadError} from "@/components/CrmLoading";
import {Brand} from "@/components/Brand";
import {db} from "@/lib/supabase";
export default function Marketing(){
 const router=useRouter(),[state,setState]=useState("loading"),[retry,setRetry]=useState(0),[signingOut,setSigningOut]=useState(false),[signOutError,setSignOutError]=useState("");
 useEffect(()=>{const c=new AbortController();setState("loading");fetch("/api/local/admin/marketing-users?self=1",{cache:"no-store",signal:c.signal}).then(async r=>{if(c.signal.aborted)return;if(r.status===401){router.replace("/acceder");return;}if(!r.ok)throw Error();const v=await r.json();if(c.signal.aborted)return;if(!v.marketing){router.replace("/entrar");return;}setState(v.active?"active":"disabled");}).catch(()=>{if(!c.signal.aborted)setState("error");});return()=>c.abort();},[router,retry]);
 async function signOut(){setSigningOut(true);setSignOutError("");try{const {error}=await db().auth.signOut();if(error)throw error;router.replace("/acceder");}catch{setSignOutError("No se pudo cerrar la sesión. Inténtalo de nuevo.");setSigningOut(false);}}
 return <main className="crm-marketing-page"><header className="crm-marketing-header"><div className="crm-marketing-identity"><Brand href="/marketing"/><div><h1>Marketing</h1><p className="muted">Tu espacio comercial</p></div></div><div className="crm-marketing-actions"><Link className="button button-outline" href="/restablecer-clave"><KeyRound size={16}/> Cambiar contraseña</Link><button type="button" className="button button-outline" disabled={signingOut} onClick={()=>void signOut()}><LogOut size={16}/> {signingOut?"Cerrando…":"Cerrar sesión"}</button></div></header>
 {signOutError&&<p role="alert" className="alert error">{signOutError}</p>}
 {state==="loading"?<CrmLoading title="Preparando tu CRM" description="Comprobando tu acceso al espacio comercial."/>:state==="active"?<AdminCrm marketingOnly/>:state==="error"?<CrmLoadError title="No se pudo comprobar el acceso" message="Comprueba tu conexión y vuelve a intentarlo." onRetry={()=>setRetry(v=>v+1)}/>:<p role="alert" className="alert error">Acceso desactivado. Contacta con administración.</p>}
 </main>;
}
