"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {BarChart3,Compass,CreditCard,LayoutDashboard,LogOut,Mail,ScanLine,Settings2,Shield,Users,UserRound,BellRing,Brush} from "lucide-react";
import {db} from "@/lib/supabase";
import {adminNavigation,adminActiveHref} from "@/lib/admin-sections";
import {KreyvIcon} from "@/components/KreyvIcon";
import {CustomerInboxNavCount} from "@/components/CustomerInboxBell";


type Role="customer"|"business"|"staff"|"admin";
const tabs={
 customer:[{href:"/app",label:"Tarjetas",icon:"mis-tarjetas"},{href:"/app/descubrir",label:"Descubrir",icon:"buscar"},{href:"/app/novedades",label:"Avisos",icon:"campanas"},{href:"/app/ajustes",label:"Ajustes",icon:"ajustes"},{href:"/app/perfil",label:"Mi perfil",icon:"perfil"}],
 business:[{href:"/negocio",label:"Mi negocio",icon:"inicio"},{href:"/negocio/tarjeta",label:"Tarjeta",icon:"mi-tarjeta"},{href:"/negocio/team",label:"Empleados",icon:"perfil"},{href:"/negocio/reports",label:"Datos",icon:"recompensa"},{href:"/negocio/marketing",label:"Campañas",icon:"campanas"}],
 staff:[{href:"/empleado",label:"Escanear",icon:"qr"}],
 admin:adminNavigation.map(item=>({href:item.href,label:item.short,icon:item.icon}))
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
 const navRef=useRef<HTMLElement>(null);
 useEffect(()=>{
  const nav=navRef.current,viewport=window.visualViewport;
  if(!nav||!viewport||!CSS.supports("-webkit-touch-callout","none"))return;
  let frame=0;
  const update=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    const inset=Math.abs(viewport.scale-1)<.01
     ?Math.max(0,document.documentElement.clientHeight-viewport.height-viewport.offsetTop):0;
    nav.style.setProperty("--kreyvi-viewport-bottom",Math.round(inset)+"px");
   });
  };
  update();
  viewport.addEventListener("resize",update);
  viewport.addEventListener("scroll",update);
  window.addEventListener("resize",update);
  window.addEventListener("pageshow",update);
  return()=>{
   cancelAnimationFrame(frame);
   viewport.removeEventListener("resize",update);
   viewport.removeEventListener("scroll",update);
   window.removeEventListener("resize",update);
   window.removeEventListener("pageshow",update);
   nav.style.removeProperty("--kreyvi-viewport-bottom");
  };
 },[inside,ready,role]);
 useEffect(()=>{
  let mounted=true;
  async function load(){
   if(!inside){setReady(false);setRole(null);return;}
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
 if(!inside||!ready||!role||inside!==role||role==="staff")return null;
 // Nunca mostramos accesos a zonas ajenas al rol.
 const items=tabs[role];
 async function logout(){
  if(!window.confirm("¿Quieres cerrar tu sesión en KREYVI?"))return;
  await db().auth.signOut();
  router.replace("/acceder");
 }
 return <nav ref={navRef} className={"mobile-bottom-nav loyalty-global-bottom-nav loyalty-nav-"+role} aria-label="Menú principal de KREYVI">
  {items.map(item=>{
   const active=role==="admin"?adminActiveHref(pathname)===item.href:item.href==="/negocio"?["/negocio","/negocio/overview","/negocio/settings","/negocio/locations","/negocio/poster"].includes(pathname):item.href==="/negocio/reports"?["/negocio/reports","/negocio/transactions","/negocio/customers"].includes(pathname):pathname===item.href;
   return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={"mobile-bottom-link"+(active?" active":"")}>{item.href==="/negocio/reports"?<BarChart3 size={20}/>:<KreyvIcon name={item.icon} size={20}/> }<span>{item.label}</span>{role==="customer"&&item.href==="/app/novedades"&&<CustomerInboxNavCount/>}</Link>;
  })}
  {role==="admin"&&<button type="button" className="mobile-bottom-link" onClick={logout}><LogOut size={20}/><span>Salir</span></button>}
 </nav>;
}
