"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {BarChart3,Compass,CreditCard,LayoutDashboard,LogOut,Mail,ScanLine,Settings2,Shield,Users,UserRound} from "lucide-react";
import {db} from "@/lib/supabase";
import {demoRole,leaveDemo} from "@/lib/demo-local";

type Role="customer"|"business"|"staff"|"admin";
const tabs={
 customer:[{href:"/app",label:"Tarjetas",icon:CreditCard},{href:"/app/descubrir",label:"Descubrir",icon:Compass},{href:"/app/perfil",label:"Mi cuenta",icon:UserRound}],
 business:[{href:"/negocio",label:"Inicio",icon:LayoutDashboard},{href:"/negocio/customers",label:"Clientes",icon:Users},{href:"/negocio/marketing",label:"Campañas",icon:Mail},{href:"/negocio/reports",label:"Resultados",icon:BarChart3},{href:"/negocio/settings",label:"Más",icon:Settings2}],
 staff:[{href:"/empleado",label:"Escanear",icon:ScanLine}],
 admin:[{href:"/admin",label:"Panel",icon:Shield}]
} as const;
function roleFromRoute(path:string):Role|null{
 if(path.startsWith("/admin"))return "admin";
 if(path.startsWith("/negocio"))return "business";
 if(path.startsWith("/empleado")||path.startsWith("/t/")||path.startsWith("/p/"))return "staff";
 if(path.startsWith("/app")||path.startsWith("/unirse/"))return "customer";
 return null;
}
export function AppBottomNav(){
 const pathname=usePathname(),router=useRouter();
 const [role,setRole]=useState<Role|null>(null),[ready,setReady]=useState(false);
 const inside=roleFromRoute(pathname);
 useEffect(()=>{
  let mounted=true;
  async function load(){
   if(!inside){setReady(false);setRole(null);return;}
   const fake=demoRole();
   if(fake){
    const r=fake==="gestor"?"business":fake==="administrador"?"admin":fake==="empleado"?"staff":"customer";
    if(mounted){setRole(r);setReady(true);}
    return;
   }
   try{
    const response=await db().auth.getUser();
    if(!mounted)return;
    if(!response.data.user){setRole(null);setReady(true);return;}
    const id=response.data.user.id;
    const [managers,admins]=await Promise.all([
     db().from("business_members").select("role").eq("user_id",id).eq("active",true),
     db().from("platform_admins").select("user_id").eq("user_id",id).maybeSingle()
    ]);
    if(!mounted)return;
    const list=(managers.data||[]) as {role:string}[];
    setRole(admins.data?"admin":list.some(r=>r.role==="owner"||r.role==="manager")?"business":list.length?"staff":"customer");
    setReady(true);
   }catch{if(mounted){setRole(null);setReady(true);}}
  }
  load();return()=>{mounted=false;};
 },[pathname,inside]);
 if(!inside||!ready||!role||inside!==role)return null;
 // Nunca mostramos accesos a zonas ajenas al rol.
 const items=tabs[role];
 async function logout(){
  if(!window.confirm("¿Quieres cerrar tu sesión en Loyally?"))return;
  if(demoRole())leaveDemo();
  else await db().auth.signOut();
  router.replace("/acceder");
 }
 return <nav className={"mobile-bottom-nav loyalty-global-bottom-nav loyalty-nav-"+role} aria-label="Menú principal de Loyally">
  {items.map(item=>{
   const active=item.href==="/negocio"?pathname==="/negocio"||pathname==="/negocio/overview":item.href==="/negocio/settings"?pathname.startsWith("/negocio/")&&!["/negocio/customers","/negocio/marketing","/negocio/reports"].includes(pathname):pathname===item.href;
   const Icon=item.icon;
   return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={"mobile-bottom-link"+(active?" active":"")}><Icon size={20}/><span>{item.label}</span></Link>;
  })}
  {(role==="staff"||role==="admin")&&<button type="button" className="mobile-bottom-link" onClick={logout}><LogOut size={20}/><span>Salir</span></button>}
 </nav>;
}
