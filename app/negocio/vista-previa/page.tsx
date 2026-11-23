"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowUpRight,Check,Copy,Eye,Gift,LockKeyhole,Share2} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {StampCard} from "@/components/StampCard";
import type {Business,Program} from "@/lib/types";
import {db} from "@/lib/supabase";
import {categoryStampKind} from "@/lib/business-categories";
import {programPromise} from "@/lib/program-presentation";
import {money} from "@/lib/format";
import {cardBackgroundUrl} from "@/lib/card-images";

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
  const url=window.location.origin+"/unirse/"+business.slug;
  try{
   if(!navigator.clipboard?.writeText)throw new Error("clipboard not available");
   await navigator.clipboard.writeText(url);setCopied(true);
  }catch{window.prompt("Copia el enlace para compartirlo con tus clientes:",url);}
 }
 if(loading)return <div className="loading-screen">Preparando la tarjeta...</div>;
 if(error||!business||!program)return <div className="empty-state"><LockKeyhole size={29}/><h3>No se pudo abrir la vista previa</h3><p>{error}</p><Link href="/negocio" className="button button-dark">Volver al negocio</Link></div>;
 const published=business.public_listing&&business.active;
 return <div className="business-preview-page">
  <Link href="/negocio/tarjeta" className="business-preview-back"><ArrowLeft size={17}/> Volver al diseño</Link>
  <div className="business-preview-layout">
   <section className="panel-card business-preview-card">
    <div className="eyebrow"><Eye size={16}/> VISTA PREVIA DE TU TARJETA</div>
    {program.type==="stamps"?
     <StampCard name={business.name} color={business.accent_color} reward={program.reward_label}
      total={Math.max(2,program.reward_cost)} earned={Math.min(3,Math.max(2,program.reward_cost))}
      icon={business.stamp_icon||categoryStampKind(business.category)} imageUrl={business.stamp_image_url}
      logoUrl={business.logo_url} backgroundUrl={business.card_background} textColor={business.card_text_color}
      stampColor={business.stamp_color} message={business.card_text||"GRACIAS POR VOLVER"}/>:
     <div className="business-preview-nonstamp" style={{backgroundColor:business.accent_color,color:business.card_text_color||"#fff",
      backgroundImage:business.card_background?"linear-gradient(120deg,rgba(0,0,0,.35),rgba(0,0,0,.16)),url("+cardBackgroundUrl(business.card_background,1200)+")":undefined}}>
      <div className="stamp-visual-head"><span className="stamp-business-logo">{business.logo_url?<img src={business.logo_url} alt=""/>:business.name.slice(0,1)}</span><span className="stamp-visual-pill">KREYV CLUB</span></div>
      <div className="business-preview-nonstamp-body"><small>{business.card_text||"GRACIAS POR VOLVER"}</small>
       <h3>{business.name}</h3><p>{program.reward_label}</p></div>
      <div className="business-preview-nonstamp-bottom"><div><span>SALDO DE EJEMPLO</span><strong>{program.type==="points"?"120 puntos":money(15000,business.currency)}</strong></div>
       <span>{program.type==="points"?"Cada compra suma puntos":"Acumula saldo con tus compras"}</span></div>
     </div>}
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
