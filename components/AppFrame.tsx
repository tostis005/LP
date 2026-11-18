"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@/lib/supabase";
import { BarChart3, Compass, CreditCard, LayoutDashboard, LogOut, ScanLine, Settings2, Shield, Store, UserRound, ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/Brand";
import { configured, db } from "@/lib/supabase";
export type BusinessRole = { business_id:string; role:"owner"|"manager"|"employee"; active:boolean; businesses:{id:string;name:string;slug:string} | null };
export type Account = { user: User; businesses: BusinessRole[]; admin: boolean; refresh: () => void };
type Area = "customer" | "business" | "staff" | "admin";
const menus: Record<Area,{href:string;label:string;icon:ReactNode}[]> = {
 customer:[{href:"/app",label:"Mis tarjetas",icon:<CreditCard size={18}/>},{href:"/app/descubrir",label:"Descubrir",icon:<Compass size={18}/>},{href:"/app/perfil",label:"Mi perfil",icon:<UserRound size={18}/>}],
 business:[{href:"/negocio",label:"Mi negocio",icon:<LayoutDashboard size={18}/>},{href:"/negocio/facturacion",label:"Facturación",icon:<CreditCard size={18}/>},{href:"/empleado",label:"Escáner",icon:<ScanLine size={18}/>},{href:"/app",label:"Mis tarjetas",icon:<CreditCard size={18}/>}],
 staff:[{href:"/empleado",label:"Escanear tarjetas",icon:<ScanLine size={18}/>},{href:"/app",label:"Mis tarjetas",icon:<CreditCard size={18}/>}],
 admin:[{href:"/admin",label:"Administración",icon:<Shield size={18}/>},{href:"/negocio",label:"Negocios",icon:<Store size={18}/>},{href:"/app",label:"Mis tarjetas",icon:<CreditCard size={18}/>}]
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
 async function logout(){await db().auth.signOut();router.push("/")}
 const allowed=area==="customer" || (area==="admin"?admin:area==="business"?roles.some(x=>x.role!=="employee"):roles.length>0);
 if(loading)return <div className="loading-screen"><div className="spinner"/> Preparando tu espacio...</div>;
 if(error)return <div className="empty-page"><h2>Falta un paso para empezar</h2><p>{error}</p><Link className="button button-dark" href="/demo">Explorar la demo</Link></div>;
 if(!user)return <div className="loading-screen">Redirigiendo al acceso...</div>;
 if(!allowed)return <div className="empty-page"><h2>Esta zona es privada</h2><p>No tienes permisos para acceder a esta sección.</p><Link className="button button-dark" href="/app">Volver a mis tarjetas</Link></div>;
 const account:Account={user,businesses:roles,admin,refresh:()=>setVersion(v=>v+1)};
 const mobileItems=[
  ...menus.customer,
  ...(roles.some(x=>x.role!=="employee")?[{href:"/negocio",label:"Negocio",icon:<Store size={19}/>}]:roles.length?[{href:"/empleado",label:"Escáner",icon:<ScanLine size={19}/>}]:[]),
  ...(admin?[{href:"/admin",label:"Admin",icon:<Shield size={19}/>}]:[])
 ];
 return <div className="workspace">
  <aside className="sidebar"><div className="sidebar-brand"><Brand/></div><div className="sidebar-caption">TU ESPACIO</div><nav className="side-links">
   {menus[area].map(i=><Link key={i.href} href={i.href} className={"side-link"+(pathname===i.href?" active":"")}>{i.icon}{i.label}</Link>)}
   {area!=="admin" && admin && <Link href="/admin" className="side-link"><Shield size={18}/>Superadministración</Link>}
   {area!=="business" && roles.some(x=>x.role!=="employee") && <Link href="/negocio" className="side-link"><Store size={18}/>Gestionar negocio</Link>}
  </nav><div className="sidebar-spacer"/><div className="sidebar-help"><div className="sidebar-help-icon">♡</div><b>Clientes que vuelven</b><p>Una experiencia que merece repetirse.</p><Link href="/demo">Ver inspiración <ArrowUpRight size={14}/></Link></div><button className="side-logout" onClick={logout}><LogOut size={17}/> Cerrar sesión</button>
  </aside>
  <div className="workspace-main"><header className="workspace-header"><div className="mobile-brand"><Brand/></div><div className="workspace-header-label"><span className="online-dot"/> Loyally / {area==="admin"?"Administración":area==="business"?"Negocios":area==="staff"?"Escáner":"Clientes"}</div><div className="workspace-user"><span>{user.email||"Mi cuenta"}</span><div className="user-avatar">{(user.email||"U").slice(0,1).toUpperCase()}</div><button type="button" className="mobile-logout" onClick={logout} aria-label="Cerrar sesión"><LogOut size={20}/></button></div></header>
   <div className="workspace-content"><div className="workspace-title"><div><p className="page-eyebrow">TU ESPACIO, A TU MANERA</p><h1>{title}</h1><p>{subtitle}</p></div></div>{children(account)}</div>
   <nav className="mobile-bottom-nav" aria-label="Navegación de la aplicación">
    {mobileItems.map(i=><Link key={i.href} href={i.href} aria-current={pathname===i.href?"page":undefined} className={"mobile-bottom-link"+(pathname===i.href?" active":"")}>{i.icon}<span>{i.label}</span></Link>)}
   </nav>
  </div>
 </div>;
}
