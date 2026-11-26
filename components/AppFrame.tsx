"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@/lib/supabase";
import { BarChart3, Compass, CreditCard, LayoutDashboard, LogOut, ScanLine, Settings2, Shield, UserRound, BellRing, Mail, Users, ChevronRight, Brush, Gift, MapPin, Store } from "lucide-react";
import {KreyviLoading} from "@/components/KreyviLoading";
import { Brand } from "@/components/Brand";
import {adminNavigation,adminActiveHref} from "@/lib/admin-sections";
import {KreyvIcon} from "@/components/KreyvIcon";
import {CustomerInboxBell} from "@/components/CustomerInboxBell";
import { configured, db } from "@/lib/supabase";
import {saveAccount,clearOfflineAccount,awards} from "@/lib/client/offline";
import type {Program} from "@/lib/types";
import {syncExistingPushSubscription} from "@/lib/client/push-sync";
export type BusinessRole = { business_id:string; role:"owner"|"manager"|"employee"; active:boolean; businesses:{id:string;name:string;slug:string} | null };
export type Account = { user: User; businesses: BusinessRole[]; admin: boolean; refresh: () => void };
type Area = "customer" | "business" | "staff" | "admin";
const menus: Record<Area,{href:string;label:string;icon:ReactNode}[]> = {
 customer:[{href:"/app",label:"Mis tarjetas",icon:<KreyvIcon name="mis-tarjetas" size={18}/>},{href:"/app/descubrir",label:"Descubrir",icon:<KreyvIcon name="buscar" size={18}/>},{href:"/app/novedades",label:"Avisos",icon:<KreyvIcon name="campanas" size={18}/>},{href:"/app/ajustes",label:"Ajustes",icon:<KreyvIcon name="ajustes" size={18}/>},{href:"/app/perfil",label:"Mi perfil",icon:<KreyvIcon name="perfil" size={18}/>}],
 business:[
  {href:"/negocio",label:"Mi negocio",icon:<KreyvIcon name="inicio" size={18}/>},
  {href:"/negocio/tarjeta",label:"Tarjeta",icon:<KreyvIcon name="mi-tarjeta" size={18}/>},
  {href:"/negocio/team",label:"Empleados",icon:<KreyvIcon name="perfil" size={18}/>},
  {href:"/negocio/reports",label:"Datos",icon:<BarChart3 size={18}/>},
  {href:"/negocio/marketing",label:"Campañas",icon:<KreyvIcon name="campanas" size={18}/>}
 ],
 staff:[{href:"/empleado",label:"Escanear tarjetas",icon:<KreyvIcon name="qr" size={18}/>}],
 admin:adminNavigation.map(item=>({href:item.href,label:item.label,icon:<KreyvIcon name={item.icon} size={18}/>}))
};
export function AppFrame({ area, title, subtitle, children }: {area:Area;title:string;subtitle:string;children:(a:Account)=>ReactNode}) {
 const router=useRouter(), pathname=usePathname();
 const activePath=area==="admin"?adminActiveHref(pathname):area==="business"&&["/negocio/customers","/negocio/transactions"].includes(pathname)?"/negocio/reports":area==="business"&&["/negocio/settings","/negocio/locations","/negocio/overview","/negocio/poster"].includes(pathname)?"/negocio":pathname;
 const [user,setUser]=useState<User|null>(null),[roles,setRoles]=useState<BusinessRole[]>([]),[admin,setAdmin]=useState(false);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[version,setVersion]=useState(0);
 useEffect(()=>{let live=true;
  async function load(){
   if(!configured()){if(live){setError("No podemos abrir tu cuenta ahora mismo. Inténtalo de nuevo.");setLoading(false)}return}
   try{
    const auth=await db().auth.getUser(); if(auth.error) throw auth.error;
    if(!auth.data.user){clearOfflineAccount();if(live){setLoading(false);router.replace("/acceder?next="+encodeURIComponent(pathname))}return}
    if(area==="customer")void syncExistingPushSubscription(auth.data.user.id);
    try { await db().rpc("claim_invitations"); } catch { /* invitaciones opcionales */ }
    const [members,admins]=await Promise.all([
      db().from("business_members").select("business_id,role,active,businesses(id,name,slug)").eq("user_id",auth.data.user.id).eq("active",true),
      db().from("platform_admins").select("user_id").eq("user_id",auth.data.user.id).maybeSingle()
    ]);
    if(members.error) throw members.error;
    if(admins.error) throw admins.error;
    if(live){
     const u=auth.data.user,rs=(members.data||[]) as unknown as BusinessRole[];
     if(area==="customer"&&!admins.data&&rs.length===0)saveAccount({id:u.id,area:"customer",at:Date.now(),businesses:[]});
     else if(area==="staff"&&rs.some(r=>r.role==="employee")){
      const staff=rs.filter(r=>r.role==="employee"),p=await db().from("loyalty_programs").select("*").in("business_id",staff.map(r=>r.business_id));
      if(!p.error&&live)saveAccount({id:u.id,area:"staff",at:Date.now(),businesses:staff.map(r=>({id:r.business_id,name:r.businesses?.name||"Negocio",program:(p.data as Program[]||[]).find(x=>x.business_id===r.business_id)}))});
      // StaffMain synchronizes the queue and refreshes its visible status.
     }else clearOfflineAccount();
     if(live){setUser(u);setRoles(rs);setAdmin(!!admins.data);setLoading(false)}
    }
   }catch(e){if(live){setError((e as Error).message);setLoading(false)}}
  }
  load();return()=>{live=false}
 },[router,version,pathname]);
 async function logout(){if(!window.confirm("¿Quieres cerrar tu sesión en KREYVI?"))return;if(user&&awards(user.id).length&&!window.confirm("Hay compras pendientes que solo podrás sincronizar al volver a iniciar sesión. ¿Continuar?"))return;const result=await db().auth.signOut();if(result.error){setError(result.error.message);return}clearOfflineAccount();router.replace("/acceder")}
 const hasBusiness=roles.some(x=>x.role==="owner"||x.role==="manager");
 const allowed=area==="customer"?!admin&&roles.length===0:area==="admin"?admin:area==="business"?hasBusiness:roles.some(x=>x.role==="employee");
 if(loading)return <KreyviLoading/>;
 if(error)return <div className="empty-page"><h2>No hemos podido abrir tu espacio</h2><p>{error}</p><a className="button button-outline" href="/offline">Abrir modo sin conexión</a><Link className="button button-dark" href="/acceder">Volver al acceso</Link></div>;
 if(!user)return <KreyviLoading label="Abriendo el acceso"/>;
 if(!allowed)return <div className="empty-page"><h2>Esta zona es privada</h2><p>No tienes permisos para acceder a esta sección.</p><Link className="button button-dark" href={admin?"/admin":roles.some(x=>x.role!=="employee")?"/negocio":roles.length?"/empleado":"/app"}>Volver a mi espacio</Link></div>;
 const account:Account={user,businesses:roles,admin,refresh:()=>setVersion(v=>v+1)};
 return <div className={"workspace workspace-"+area}>
  <aside className="sidebar"><div className="sidebar-brand"><Brand/></div><div className="sidebar-caption">NAVEGACIÓN</div><nav className="side-links" aria-label="Menú principal">
   {menus[area].map(i=><Link key={i.href} href={i.href} aria-current={activePath===i.href?"page":undefined} className={"side-link"+(activePath===i.href?" active":"")}>{i.icon}{i.label}</Link>)}
  </nav><div className="sidebar-spacer"/><button type="button" className="side-logout" onClick={logout}><LogOut size={17}/> Cerrar sesión</button>
  </aside>
  <div className="workspace-main">{area==="customer"&&<div className="customer-native-header"><Brand/><CustomerInboxBell/></div>}<header className="workspace-header"><div className="mobile-brand"><Brand/></div><div className="workspace-header-label">{area==="admin"?"Administración":area==="business"?"Negocios":area==="staff"?"Escáner":"Mi cuenta"}</div><div className="workspace-user">{area==="customer"&&<CustomerInboxBell/>}{area==="business"?<details className="business-account-menu"><summary><UserRound size={18}/> Mi cuenta <ChevronRight size={15}/></summary><div className="business-account-dropdown">
  <Link href="/negocio/settings"><Store size={17}/> Datos del negocio</Link>
  <Link href="/negocio/locations"><MapPin size={17}/> Dirección y ubicación</Link>
  {roles.some(r=>r.role==="owner")&&<Link href="/negocio/facturacion"><CreditCard size={17}/> Facturación y pagos</Link>}
 </div></details>:<><span>{user.user_metadata?.full_name||({business:"Mi negocio",staff:"Personal",admin:"Administración",customer:"Mi cuenta"}[area])}</span><div className="user-avatar">{(user.user_metadata?.full_name||"L").slice(0,1).toUpperCase()}</div></>}
 <button type="button" className="mobile-logout" onClick={logout} aria-label="Cerrar sesión"><LogOut size={20}/></button></div></header>
   <div className="workspace-content">{area==="business"&&pathname.startsWith("/negocio/")&&<nav className="workspace-breadcrumbs" aria-label="Ruta de navegación">
     <Link href="/negocio">Mi negocio</Link><ChevronRight size={14}/>
     <span aria-current="page">{pathname==="/negocio/settings"?"Información":pathname==="/negocio/locations"?"Ubicación":pathname==="/negocio/poster"?"QR para mostrador":pathname==="/negocio/customers"?"Datos · Clientes":pathname==="/negocio/transactions"?"Datos · Transacciones":menus.business.find(i=>i.href===activePath)?.label|| (pathname==="/negocio/vista-previa"?"Vista previa":"Mi negocio")}</span>
    </nav>}
<div className="workspace-title"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div></div>{children(account)}</div>

  </div>
 </div>;
}
