"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import {useParams,useRouter} from "next/navigation";
import {ArrowUpRight,Gift,Heart,MapPin,Check,ArrowLeft} from "lucide-react";
import {Brand} from "@/components/Brand";
import {StampCard} from "@/components/StampCard";
import {StampMark} from "@/components/StampMarks";
import {categoryStampKind} from "@/lib/business-categories";
import {programPromise,programExplanation} from "@/lib/program-presentation";
import type {Business,Location,Program} from "@/lib/types";
import {db,configured} from "@/lib/supabase";
const DirectoryMapView=dynamic(()=>import("@/components/DirectoryMap"),{ssr:false,loading:()=> <div className="map-placeholder">Preparando el mapa...</div>});
type Offer={business_id:string;business_name:string;description:string|null;accent_color:string;reward_label:string;program_type:Program["type"]};
export default function JoinPage(){
 const params=useParams<{slug:string}>(),router=useRouter();
 const [offer,setOffer]=useState<Offer|null>(null),[business,setBusiness]=useState<Business|null>(null);
 const [program,setProgram]=useState<Program|null>(null),[locations,setLocations]=useState<Location[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [signed,setSigned]=useState(false),[joined,setJoined]=useState(false),[success,setSuccess]=useState(false),[marketing,setMarketing]=useState(false);
 useEffect(()=>{let alive=true;async function load(){
  if(!configured()){setError("No se ha podido conectar con Loyally.");setLoading(false);return}
  const [o,u]=await Promise.all([db().rpc("find_join_business",{p_slug:params.slug}),db().auth.getUser()]);
  if(!alive)return;
  setSigned(!!u.data.user);
  if(o.error||!o.data?.length){setError("No hemos encontrado un programa disponible con este enlace.");setLoading(false);return}
  const found=o.data[0] as Offer;setOffer(found);
  const [b,p,l,m]=await Promise.all([
   db().from("businesses").select("*").eq("id",found.business_id).maybeSingle(),
   db().from("loyalty_programs").select("*").eq("business_id",found.business_id).maybeSingle(),
   db().from("business_locations").select("*").eq("business_id",found.business_id).eq("visible",true),
   u.data.user?db().from("loyalty_memberships").select("id").eq("business_id",found.business_id).eq("customer_id",u.data.user.id).maybeSingle():Promise.resolve({data:null,error:null})
  ]);
  if(!alive)return;
  setBusiness(b.data as Business|null);setProgram(p.data as Program|null);setLocations((l.data||[]) as Location[]);
  setJoined(!!m.data);setLoading(false);
 }load();return()=>{alive=false}},[params.slug]);
 async function join(){if(!offer)return;
  if(!signed){window.localStorage.setItem("lp_pending_join",offer.business_id);router.push("/acceder");return}
  setBusy(true);setError("");
  const result=await db().rpc("join_program",{p_business:offer.business_id});
  if(result.error){setBusy(false);setError(result.error.message);return}
  if(marketing){
   const consent=await db().rpc("business_upsert_consent",{p_business:offer.business_id,p_opted_in:true});
   if(consent.error){setError("Tu tarjeta está lista, pero no se pudo guardar la preferencia de ofertas: "+consent.error.message)}
  }
  setBusy(false);setJoined(true);setSuccess(true);
 }
 const category=business?.category||null;
 const offerProgram=program|| (offer?{type:offer.program_type,reward_label:offer.reward_label}:null);
 const hasLocation=locations.length>0;
 return <div className="join-page join-page-rich">
  <div className="join-top"><Brand/><Link href="/app/descubrir" className="text-link"><ArrowLeft size={16}/> Explorar negocios</Link></div>
  {loading?<div className="join-box"><div className="loading-screen">Descubriendo este negocio...</div></div>:!offer?<div className="join-box"><div className="empty-state"><h2>Este enlace no está disponible</h2><p>{error}</p></div></div>:
   <main className="join-detail">
    <div className="join-detail-main">
     <div className="join-business-hero" style={{background:offer.accent_color||"#264d3e"}}>
      <div className="join-business-illustration"><StampMark kind={categoryStampKind(category)} size={66}/></div>
      <span className="join-business-category">{category||"Negocio local"}</span>
      <h1>{offer.business_name}</h1>
      <p>{offer.description||"Un lugar al que siempre apetece volver. Descubre qué lo hace especial y empieza a disfrutar de sus recompensas."}</p>
     </div>
     <section className="join-info-panel">
      <span className="eyebrow">UNA BUENA VISITA MERECE UN PREMIO</span>
      <h2>Así funciona su programa</h2>
      <div className="join-reward-large"><Gift size={23}/><strong>{programPromise(offerProgram)}</strong></div>
      <p>{programExplanation(offerProgram)}</p>
      {offerProgram?.type==="stamps"&&program&&<div className="join-card-preview">
       <StampCard name={offer.business_name} color={business?.accent_color||offer.accent_color} reward={program.reward_label} total={Math.max(2,program.reward_cost)} earned={0} icon={business?.stamp_icon||categoryStampKind(category)} message={business?.card_text||"GRACIAS POR VOLVER"} textColor={business?.card_text_color} stampColor={business?.stamp_color}/>
       <small>Así será tu tarjeta al comenzar. Cada visita te acercará a tu premio.</small>
      </div>}
      {success||joined?<div className="join-subscribed"><Check size={20}/><div><strong>¡Ya tienes tu tarjeta!</strong><p>La encontrarás junto a tus demás tarjetas. Puedes abrirla, enseñarla en el negocio o guardarla en tu dispositivo.</p></div><Link href="/app" className="button button-dark">Ver y guardar mi tarjeta <ArrowUpRight size={16}/></Link></div>:
      <div className="join-subscribe">
       <h3>¿Te apuntas?</h3>
       <p>Unirte es gratis. Podrás consultar tus sellos y recompensas siempre que quieras.</p>
       {signed&&<label className="join-marketing-choice"><input type="checkbox" checked={marketing} onChange={e=>setMarketing(e.target.checked)}/><span><strong>También quiero recibir ofertas de {offer.business_name}</strong><small>Opcional. Puedes cambiarlo en cualquier momento. Los avisos necesarios sobre tu tarjeta no dependen de esta casilla.</small></span></label>}
       {error&&<div className="alert error" role="alert">{error}</div>}
       <button disabled={busy} onClick={join} className="button button-dark button-full">{busy?"Preparando tu tarjeta...":signed?"Conseguir mi tarjeta gratis":"Entrar y conseguir mi tarjeta"} <ArrowUpRight size={17}/></button>
      </div>}
     </section>
    </div>
    <aside className="join-detail-side">
     <section className="join-side-card"><div className="panel-icon"><MapPin size={21}/></div><h2>¿Dónde está?</h2>
      {hasLocation?locations.map(l=><div className="join-address" key={l.id}><strong>{l.name}</strong><span>{l.address}</span><span>{l.city}, {l.country}</span><a target="_blank" rel="noopener noreferrer" href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(l.lat+","+l.lng)}>Cómo llegar <ArrowUpRight size={14}/></a></div>):<p>Este negocio todavía no ha añadido una dirección pública.</p>}
     </section>
     {hasLocation&&<div className="join-mini-map"><DirectoryMapView locations={locations.map(l=>({...l,businesses:{name:offer.business_name,category,slug:params.slug,accent_color:offer.accent_color},offerText:programPromise(offerProgram)}))} center={[locations[0].lat,locations[0].lng]}/></div>}
     <section className="join-side-card"><Heart size={23}/><h3>Cada visita tiene algo bueno</h3><p>Descubre negocios, elige tus favoritos y lleva todas tus tarjetas en Loyally.</p><Link href="/app/descubrir">Seguir explorando <ArrowUpRight size={15}/></Link></section>
    </aside>
   </main>
  }
 </div>;
}
