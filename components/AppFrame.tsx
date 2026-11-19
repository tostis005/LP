"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@/lib/supabase";
import { BarChart3, Compass, CreditCard, LayoutDashboard, LogOut, ScanLine, Settings2, Shield, UserRound, Mail, Users, ChevronRight } from "lucide-react";
import { Brand } from "@/components/Brand";
import { configured, db } from "@/lib/supabase";
import {leaveDemo} from "@/lib/demo-local";
export type BusinessRole = { business_id:string; role:"owner"|"manager"|"employee"; active:boolean; businesses:{id:string;name:string;slug:string} | null };
export type Account = { user: User; businesses: BusinessRole[]; admin: boolean; refresh: () => void };
type Area = "customer" | "business" | "staff" | "admin";
const menus: Record<Area,{href:string;label:string;icon:ReactNode}[]> = {
 customer:[{href:"/app",label:"Mis tarjetas",icon:<CreditCard size={18}/>},{href:"/app/descubrir",label:"Descubrir",icon:<Compass size={18}/>},{href:"/app/perfil",label:"Mi perfil",icon:<UserRound size={18}/>}],
 business:[
  {href:"/negocio",label:"Resumen",icon:<LayoutDashboard size={18}/>},
  {href:"/negocio/customers",label:"Clientes",icon:<Users size={18}/>},
  {href:"/negocio/marketing",label:"Campañas",icon:<Mail size={18}/>},
  {href:"/negocio/reports",label:"Resultados",icon:<BarChart3 size={18}/>},
  {href:"/negocio/settings",label:"Más opciones",icon:<Settings2 size={18}/>}
 ],
 staff:[{href:"/empleado",label:"Escanear tarjetas",icon:<ScanLine size={18}/>}],
 admin:[{href:"/admin",label:"Administración",icon:<Shield size={18}/>}]
};
export function AppFrame({ area, title, subtitle, children }: {area:Area;title:string;subtitle:string;children:(a:Account)=>ReactNode}) {
 const router=useRouter(), pathname=usePathname();
 const [user,setUser]=useState<User|null>(null),[roles,setRoles]=useState<BusinessRole[]>([]),[admin,setAdmin]=useState(false);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[version,setVersion]=useState(0);
 useEffect(()=>{let live=true;
  async function load(){
   if(!configured()){if(live){setError("No se ha podido conectar con el servidor Loyally. Comprueba la base de datos.");setLoading(false)}return}
   try{
    const auth=await db().auth.getUser(); if(auth.error) throw auth.error;
    if(!auth.data.user){if(live){setLoading(false);router.replace("/acceder")}return}
    try { await db().rpc("claim_invitations"); } catch { /* invitaciones opcionales */ }
    const [members,admins]=await Promise.all([
      db().from("business_members").select("business_id,role,active,businesses(id,name,slug)").eq("user_id",auth.data.user.id).eq("active",true),
      db().from("platform_admins").select("user_id").eq("user_id",auth.data.user.id).maybeSingle()
    ]);
    if(members.error) throw members.error;
    if(live){setUser(auth.data.user);setRoles((members.data||[]) as unknown as BusinessRole[]);setAdmin(!!admins.data);setLoading(false)}
   }catch(e){if(live){setError((e as Error).message);setLoading(false)}}
  }
  load();return()=>{live=false}
 },[router,version]);
 async function logout(){if(!window.confirm("¿Quieres cerrar tu sesión en Loyally?"))return;await db().auth.signOut();leaveDemo();router.replace("/acceder")}
 const hasBusiness=roles.some(x=>x.role==="owner"||x.role==="manager");
 const allowed=area==="customer"?!admin&&roles.length===0:area==="admin"?admin:area==="business"?hasBusiness:roles.some(x=>x.role==="employee");
 if(loading)return <div className="loading-screen"><div className="spinner"/> Preparando tu espacio...</div>;
 if(error)return <div className="empty-page"><h2>Falta un paso para empezar</h2><p>{error}</p><Link className="button button-dark" href="/acceder">Volver al acceso</Link></div>;
 if(!user)return <div className="loading-screen">Redirigiendo al acceso...</div>;
 if(!allowed)return <div className="empty-page"><h2>Esta zona es privada</h2><p>No tienes permisos para acceder a esta sección.</p><Link className="button button-dark" href={admin?"/admin":roles.some(x=>x.role!=="employee")?"/negocio":roles.length?"/empleado":"/app"}>Volver a mi espacio</Link></div>;
 const account:Account={user,businesses:roles,admin,refresh:()=>setVersion(v=>v+1)};
 return <div className={"workspace workspace-"+area}>
  <aside className="sidebar"><div className="sidebar-brand"><Brand/></div><div className="sidebar-caption">NAVEGACIÓN</div><nav className="side-links" aria-label="Menú principal">
   {menus[area].map(i=><Link key={i.href} href={i.href} aria-current={pathname===i.href?"page":undefined} className={"side-link"+(pathname===i.href||i.href==="/negocio/settings"&&pathname.startsWith("/negocio/")&&!["/negocio/customers","/negocio/marketing","/negocio/reports"].includes(pathname)?" active":"")}>{i.icon}{i.label}</Link>)}
  </nav><div className="sidebar-spacer"/><button type="button" className="side-logout" onClick={logout}><LogOut size={17}/> Cerrar sesión</button>
  </aside>
  <div className="workspace-main"><header className="workspace-header"><div className="mobile-brand"><Brand/></div><div className="workspace-header-label"><span className="online-dot"/> Loyally / {area==="admin"?"Administración":area==="business"?"Negocios":area==="staff"?"Escáner":"Clientes"}</div><div className="workspace-user"><span>{user.user_metadata?.full_name||({business:"Mi negocio",staff:"Personal",admin:"Administración",customer:"Mi cuenta"}[area])}</span><div className="user-avatar">{(user.user_metadata?.full_name||"L").slice(0,1).toUpperCase()}</div><button type="button" className="mobile-logout" onClick={logout} aria-label="Cerrar sesión"><LogOut size={20}/></button></div></header>
   <div className="workspace-content">{area==="business"&&pathname.startsWith("/negocio/")&&<nav className="workspace-breadcrumbs" aria-label="Ruta de navegación">
     <Link href="/negocio">Mi negocio</Link><ChevronRight size={14}/>
     {["designer","program","team","locations","facturacion","vista-previa"].includes(pathname.split("/")[2])&&<><Link href="/negocio/settings">Más opciones</Link><ChevronRight size={14}/></>}
     <span aria-current="page">{({"designer":"Diseño de tarjeta","program":"Premios y sellos","team":"Equipo","locations":"Locales","facturacion":"Facturación","vista-previa":"Vista previa","settings":"Más opciones"} as Record<string,string>)[pathname.split("/")[2]]||menus.business.find(x=>x.href===pathname)?.label||"Mi negocio"}</span>
    </nav>}<div className="workspace-title"><div><p className="page-eyebrow">TU ESPACIO, A TU MANERA</p><h1>{title}</h1><p>{subtitle}</p></div></div>{children(account)}</div>

  </div>
 </div>;
}
