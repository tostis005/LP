"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,BellRing,Clock3,Gift} from "lucide-react";
import {AppFrame} from "@/components/AppFrame";
type Offer={id:string;business_id:string;business_name:string;title:string;preview:string;image_url:string|null;
 valid_until:string|null;received_at:string;seen_at:string|null};
export default function NewsPage(){
 const [offers,setOffers]=useState<Offer[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [filter,setFilter]=useState(""),[showExpired,setShowExpired]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const r=await fetch("/api/local/offers",{credentials:"same-origin",cache:"no-store"});
   const result=await r.json() as {items?:Offer[];error?:string};
   if(!r.ok||result.error)throw new Error(result.error||"No se pudieron cargar tus novedades.");
   setOffers(result.items||[]);
  }catch(e){setError((e as Error).message)}finally{setLoading(false)}
 },[]);
 useEffect(()=>{setFilter(new URLSearchParams(window.location.search).get("business")||"");void load()},[load]);
 const now=new Date().toISOString().slice(0,10);
 const current=useMemo(()=>offers.filter(o=>(!filter||o.business_id===filter)&&
  (showExpired||!o.valid_until||o.valid_until>=now)),[offers,filter,showExpired,now]);
 const unread=offers.filter(o=>!o.seen_at).length;
 return <AppFrame area="customer" title="Novedades" subtitle="Tus ofertas siempre a mano.">
  {()=> <div className="kreyv-news">
   <div className="content-heading"><div><h2>Ofertas de tus negocios</h2>
    <p>{unread?unread+" novedades sin leer":"Todo al día"} · {offers.length} ofertas guardadas</p></div>
    <button type="button" className="button button-outline button-sm" onClick={()=>void load()}>Actualizar</button></div>
   {filter&&<Link className="button button-outline button-sm" href="/app/novedades" onClick={()=>setFilter("")}>Ver todos los negocios</Link>}
   <label className="kreyv-expired-toggle"><input type="checkbox" checked={showExpired} onChange={e=>setShowExpired(e.target.checked)}/> Mostrar ofertas caducadas</label>
   {error&&<div className="alert error" role="alert">{error}</div>}
   {loading?<div className="soft-panel">Cargando novedades...</div>:
   current.length?<div className="kreyv-news-grid">{current.map(o=>{
    const expired=!!o.valid_until&&o.valid_until<now;
    return <Link key={o.id} href={"/app/novedades/"+o.id} className="kreyv-news-item">
     {o.image_url&&<img src={o.image_url} alt="" loading="lazy"/>}
     <div className="kreyv-news-item-content">
      <div className="kreyv-news-meta"><span>{o.business_name}</span>
       {!o.seen_at&&<span className="kreyv-new-dot">Nueva</span>}</div>
      <strong>{o.title}</strong><p>{o.preview}</p>
      <small>{expired?"Oferta caducada":o.valid_until?"Válida hasta "+o.valid_until:"Oferta disponible"}</small>
     </div><ArrowUpRight size={18}/>
    </Link>})}</div>:<div className="empty-state"><div className="empty-symbol"><Gift size={27}/></div>
     <h3>No hay ofertas {showExpired?"guardadas":"vigentes"}</h3>
     <p>Cuando recibas campañas de tus negocios, podrás volver a verlas aquí.</p>
     <Link href="/app" className="button button-dark">Mis tarjetas <ArrowUpRight size={16}/></Link>
    </div>}
  </div>}
 </AppFrame>;
}
