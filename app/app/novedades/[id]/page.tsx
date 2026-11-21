"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,CalendarDays,Gift} from "lucide-react";
import {usePathname} from "next/navigation";
import {AppFrame} from "@/components/AppFrame";
type Offer={id:string;business_id:string;business_name:string;title:string;preview:string;details:string;terms:string;
 image_url:string|null;valid_until:string|null;received_at:string;seen_at:string|null};
export default function OfferDetailPage(){
 const pathname=usePathname(),id=pathname.split("/").filter(Boolean).at(-1)||"";
 const [offer,setOffer]=useState<Offer|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const r=await fetch("/api/local/offers?id="+encodeURIComponent(id),{cache:"no-store",credentials:"same-origin"});
   const v=await r.json() as {offer?:Offer;error?:string};
   if(!r.ok||!v.offer)throw new Error(v.error||"La oferta no está disponible.");
   setOffer(v.offer);
   await fetch("/api/local/offers",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"read",offer_id:id})}).catch(()=>{});
  }catch(e){setError((e as Error).message)}finally{setLoading(false)}
 },[id]);
 useEffect(()=>{void load()},[load]);
 const expired=!!offer?.valid_until&&offer.valid_until<new Date().toISOString().slice(0,10);
 return <AppFrame area="customer" title="Detalle de la oferta" subtitle="Consulta todas las condiciones.">
  {()=> <div className="kreyv-offer-detail">
   <Link className="button button-outline button-sm" href="/app/novedades"><ArrowLeft size={16}/> Volver a Novedades</Link>
   {loading&&<div className="soft-panel">Cargando oferta...</div>}
   {error&&<div className="alert error" role="alert">{error}</div>}
   {offer&&<article className="panel-card">
    {offer.image_url&&<img src={offer.image_url} alt="" className="kreyv-offer-hero"/>}
    <span className="page-eyebrow">{offer.business_name}</span>
    <h2>{offer.title}</h2><p className="kreyv-offer-lead">{offer.preview}</p>
    {offer.valid_until&&<div className="kreyv-offer-validity"><CalendarDays size={17}/>
     {expired?"Esta oferta ha caducado":"Válida hasta el "+new Date(offer.valid_until+"T12:00:00").toLocaleDateString("es-ES")}</div>}
    <h3>Detalle de la promoción</h3><p className="kreyv-offer-copy">{offer.details}</p>
    {offer.terms&&<><h3>Condiciones</h3><p className="kreyv-offer-copy">{offer.terms}</p></>}
    <Link className="button button-dark" href="/app"><Gift size={17}/> Ver mis tarjetas</Link>
   </article>}
  </div>}
 </AppFrame>;
}
