"use client";
import {useEffect,useMemo,useState} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import {Compass,MapPin,Navigation,Search,ArrowUpRight,Check,Gift,Wallet} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {StampMark} from "@/components/StampMarks";
import {db} from "@/lib/supabase";
import type {Location,Business,Program} from "@/lib/types";
import {BUSINESS_CATEGORIES,PROGRAM_TYPES,categoryStampKind} from "@/lib/business-categories";
import {programPromise} from "@/lib/program-presentation";
import type {DirectoryPin} from "@/components/DirectoryMap";
type Entry=Location&{businesses:Business;visible?:boolean};
const DirectoryMapView=dynamic(()=>import("@/components/DirectoryMap"),{ssr:false,loading:()=> <div className="map-placeholder">Preparando el mapa de negocios...</div>});
const TIJUANA:[number,number]=[32.5234,-117.0382];

function Discover({account}:{account:Account}){
 const [entries,setEntries]=useState<Entry[]>([]);
 const [programs,setPrograms]=useState<Program[]>([]);
 const [myCards,setMyCards]=useState<Record<string,string>>({});
 const [wallets,setWallets]=useState({apple:false,google:false});
 const [filter,setFilter]=useState(""),[category,setCategory]=useState("Todos"),[rewardType,setRewardType]=useState("Todos");
 const [center,setCenter]=useState<[number,number]>(TIJUANA),[hasLocation,setHasLocation]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{fetch("/api/local/wallet/status",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(v=>{if(v)setWallets({apple:v.apple===true,google:v.google===true})}).catch(()=>{});},[]);
 useEffect(()=>{async function load(){
  const [loc,members,p]=await Promise.all([
   db().from("business_locations").select("*,businesses(*)").eq("visible",true),
   db().from("loyalty_memberships").select("id,business_id").eq("customer_id",account.user.id),
   db().from("loyalty_programs").select("*")
  ]);
  if(loc.error)setError(loc.error.message);else setEntries((loc.data||[]) as Entry[]);
  if(p.error)setError(p.error.message);else setPrograms((p.data||[]) as Program[]);
  setMyCards(Object.fromEntries(((members.data||[]) as {id:string;business_id:string}[]).map(x=>[x.business_id,x.id])));
 }load()},[account.user.id]);
 function locate(){
  if(!navigator.geolocation){setError("Tu navegador no puede consultar la ubicación.");return}
  navigator.geolocation.getCurrentPosition(p=>{setCenter([p.coords.latitude,p.coords.longitude]);setHasLocation(true);setError("")},
   ()=>setError("No hemos podido conocer tu ubicación. Seguimos mostrando los negocios disponibles."),{enableHighAccuracy:false,timeout:8000});
 }
 const categories=["Todos",...BUSINESS_CATEGORIES.map(x=>x.name).filter(x=>entries.some(e=>e.businesses?.category===x))];
 const programByBusiness=useMemo(()=>new Map(programs.map(p=>[p.business_id,p])),[programs]);
 const distance=(e:Entry)=>{const [a,b]=center,deg=Math.PI/180;const x=(e.lng-b)*Math.cos((a+e.lat)/2*deg),y=e.lat-a;return Math.round(Math.sqrt(x*x+y*y)*111.2*10)/10};
 const filtered=useMemo(()=>entries.filter(e=>
  e.businesses?.active&&e.businesses?.public_listing&&
  (category==="Todos"||e.businesses?.category===category)&&
  (rewardType==="Todos"||programByBusiness.get(e.business_id)?.type===rewardType)&&
  [e.businesses?.name,e.businesses?.description,e.name,e.city,e.country,e.address,programByBusiness.get(e.business_id)?.reward_label]
   .join(" ").toLocaleLowerCase().includes(filter.toLocaleLowerCase())
 ).sort((a,b)=>hasLocation?distance(a)-distance(b):a.businesses.name.localeCompare(b.businesses.name,"es")),[entries,category,rewardType,filter,center,hasLocation,programByBusiness]);
 const pins:DirectoryPin[]=filtered.map(e=>({...e,hasCard:Boolean(myCards[e.business_id]),offerText:programPromise(programByBusiness.get(e.business_id))}));
 return <>
  <div className="discover-top"><div className="search-box"><Search size={19}/><input aria-label="Buscar negocios" placeholder="Busca por negocio, recompensa o zona..." value={filter} onChange={e=>setFilter(e.target.value)}/></div>
   <button className="button button-outline" onClick={locate}><Navigation size={17}/>{hasLocation?"Actualizar ubicación":"Negocios cerca de mí"}</button></div>
  <div className="directory-filter-group"><strong>Categoría</strong><div className="chip-row">{categories.map(c=><button className={"filter-chip"+(category===c?" selected":"")} aria-pressed={category===c} key={c} onClick={()=>setCategory(c)}>{c!=="Todos"&&<StampMark kind={categoryStampKind(c)} size={18}/>} {c}</button>)}</div></div>
  <div className="directory-filter-group"><strong>Tipo de recompensa</strong><div className="chip-row">{["Todos",...PROGRAM_TYPES.map(x=>x.id)].map(t=><button className={"filter-chip"+(rewardType===t?" selected":"")} key={t} aria-pressed={rewardType===t} onClick={()=>setRewardType(t)}>{t==="Todos"?"Todas":PROGRAM_TYPES.find(x=>x.id===t)?.label}</button>)}</div></div>
  {error&&<div className="alert error" role="alert">{error}</div>}
  <div className="directory-map-legend" aria-label="Significado de los marcadores del mapa"><span><span className="map-legend-star filled" aria-hidden="true">★</span> Ya tienes tarjeta</span><span><span className="map-legend-star outline" aria-hidden="true">☆</span> Aún no tienes tarjeta</span></div>
  <div className="directory-map directory-map-primary"><DirectoryMapView locations={pins} center={hasLocation?center:(filtered.length?[filtered[0].lat,filtered[0].lng]:TIJUANA)}/></div>
  <div className="content-heading spaced"><div><h2>{filtered.length} {filtered.length===1?"negocio":"negocios"}</h2></div></div>
  <div className="directory-results-grid">
   {filtered.length===0?<div className="empty-state compact"><Compass size={29}/><h3>Sin resultados</h3><p>Prueba con otro tipo de negocio o elimina algún filtro.</p></div>:
   filtered.map(e=>{const program=programByBusiness.get(e.business_id),cardId=myCards[e.business_id],already=!!cardId;return <article key={e.id} className="directory-card directory-card-rich directory-card-premium">
    <div className={"directory-card-cover"+(e.businesses.card_background?" has-cover-photo":"")} style={{backgroundColor:e.businesses.accent_color||"#5E1A2B"}}>
     {e.businesses.card_background&&<img className="directory-cover-photo" src={e.businesses.card_background} alt="" loading="lazy"/>}
     <div className="directory-cover-top"><span className="directory-cover-category">{e.businesses.category||"Negocio local"}</span>{already&&<span className="joined-badge directory-joined"><Check size={13}/> Ya tienes tarjeta</span>}</div>
     <div className="directory-cover-brand"><span className="directory-cover-icon">{e.businesses.logo_url?<img src={e.businesses.logo_url} alt={"Logotipo de "+e.businesses.name} loading="lazy"/>:<StampMark kind={e.businesses.stamp_icon||categoryStampKind(e.businesses.category)} size={43} color={e.businesses.stamp_color||"#571c32"}/>}</span></div>
    </div>
    <div className="directory-card-body">
     <div className="directory-card-heading"><strong>{e.businesses.name}</strong></div>
     {e.businesses.description&&<p className="directory-business-description">{e.businesses.description}</p>}
     <div className="directory-reward-highlight"><span><Gift size={16}/> Recompensa</span><strong>{programPromise(program)}</strong></div>
     <p className="directory-location"><MapPin size={15}/><span>{e.address} · {e.city}, {e.country}</span></p>
     <div className="directory-card-footer">
      {hasLocation&&<span className="distance-tag">{distance(e)} km aprox.</span>}
      <Link href={already?"/app?card="+encodeURIComponent(cardId):"/unirse/"+encodeURIComponent(e.businesses.slug)} className="button button-dark button-sm">{already?"Ver tarjeta":"Conseguir tarjeta"} <ArrowUpRight size={16}/></Link>
     </div>
     {already&&(wallets.apple||wallets.google)&&<div className="directory-wallet-links">
      {wallets.apple&&<a href={"/api/local/wallet/apple?card="+encodeURIComponent(cardId)}><Wallet size={16}/> Apple Wallet</a>}
      {wallets.google&&<a href={"/api/local/wallet/google?card="+encodeURIComponent(cardId)}><Wallet size={16}/> Google Wallet</a>}
     </div>}
    </div>
   </article>})}
  </div>
 </>;
}
export default function DiscoverPage(){return <AppFrame area="customer" title="Descubrir negocios" subtitle="">{a=><Discover account={a}/>}</AppFrame>}
