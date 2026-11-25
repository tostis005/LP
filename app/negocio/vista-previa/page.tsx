"use client";
import {KreyviLoading} from "@/components/KreyviLoading";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowUpRight,Check,Copy,Eye,Gift,LockKeyhole,Share2} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {MerchantCard} from "@/components/StampCard";
import type {Business,Program} from "@/lib/types";
import {db} from "@/lib/supabase";
import {programPromise} from "@/lib/program-presentation";
import {publicJoinUrl} from "@/lib/public-url";

function Preview({account}:{account:Account}){
 const [business,setBusiness]=useState<Business|null>(null),[program,setProgram]=useState<Program|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[copied,setCopied]=useState(false);
 const managerIds=account.businesses.filter(x=>x.role!=="employee").map(x=>x.business_id);
 useEffect(()=>{
  const id=new URLSearchParams(window.location.search).get("business")||
   window.sessionStorage.getItem("loyally_selected_business")||managerIds[0];
  if(!id||!managerIds.includes(id)){setLoading(false);setError("Este negocio no está asignado a tu cuenta.");return}
  let active=true;
  Promise.all([db().from("businesses").select("*").eq("id",id).maybeSingle(),
   db().from("loyalty_programs").select("*").eq("business_id",id).maybeSingle()])
   .then(([b,p])=>{
    if(!active)return;
    if(b.error||p.error||!b.data||!p.data)setError(b.error?.message||p.error?.message||"No se pudo cargar la tarjeta del negocio.");
    else {setBusiness(b.data as Business);setProgram(p.data as Program);}
   }).catch(()=>{if(active)setError("No se pudo cargar la vista previa.");})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false}
 },[account.user.id]);
 async function copy(){
  if(!business)return;
  const url="https://kreyvi.com/unirse/"+encodeURIComponent(business.slug);
  try{
   if(!navigator.clipboard?.writeText)throw new Error("clipboard not available");
   await navigator.clipboard.writeText(url);setCopied(true);
  }catch{window.prompt("Copia el enlace para compartirlo con tus clientes:",url);}
 }
 if(loading)return <KreyviLoading compact label="Preparando la tarjeta"/>;
 if(error||!business||!program)return <div className="empty-state"><LockKeyhole size={29}/><h3>No se pudo abrir la vista previa</h3><p>{error}</p><Link href="/negocio" className="button button-dark">Volver al negocio</Link></div>;
 const published=business.public_listing&&business.active;
 return <div className="business-preview-page">
  <Link href="/negocio/tarjeta" className="business-preview-back"><ArrowLeft size={17}/> Volver al diseño</Link>
  <div className="business-preview-layout">
   <section className="panel-card business-preview-card">
    <div className="eyebrow"><Eye size={16}/> VISTA PREVIA DE TU TARJETA</div>
    <MerchantCard business={business} program={program} balance={program.type==="stamps"?Math.min(3,program.reward_cost):program.type==="points"?120:15000} qrValue={publicJoinUrl(business.slug)}/>
    <p className="muted">Es una muestra del diseño. Los sellos y saldos mostrados son de ejemplo.</p>
   </section>
   <section className="panel-card business-preview-share">
    <div className="panel-icon"><Gift size={23}/></div><h2>Así lo verán tus clientes</h2>
    <p className="muted">Recompensa: <strong>{programPromise(program)}</strong></p>
    {published?<><div className="alert success"><Check size={17}/> Tu ficha está publicada y los clientes ya pueden registrarse.</div>
     <Link className="button button-dark button-full" href={"/unirse/"+encodeURIComponent(business.slug)} target="_blank" rel="noopener noreferrer">Abrir ficha pública <ArrowUpRight size={18}/></Link>
     <button className="button button-outline button-full" type="button" onClick={copy}><Copy size={17}/>{copied?"Enlace copiado":"Copiar enlace para clientes"}</button>
    </>:<><div className="info-callout"><LockKeyhole size={18}/> La ficha todavía no es pública. La vista previa funciona igualmente, sin permitir registros.</div>
     <Link className="button button-dark button-full" href="/negocio/settings">Configurar publicación <ArrowUpRight size={18}/></Link>
    </>}
    <Link href="/negocio/designer" className="button button-outline button-full">Editar diseño <ArrowUpRight size={17}/></Link>
   </section>
  </div>
 </div>;
}
export default function BusinessPreviewPage(){
 return <AppFrame area="business" title="Vista previa" subtitle="Tu tarjeta, tal y como la verá tu comunidad.">{a=><Preview account={a}/>}</AppFrame>;
}
