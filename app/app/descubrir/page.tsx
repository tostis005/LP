"use client";
import {useEffect,useMemo,useState} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import {Compass,MapPin,Navigation,Search,ArrowUpRight,Check,Gift,Wallet,Heart} from "lucide-react";
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
 ).sort((a,b)=>distance(a)-distance(b)),[entries,category,rewardType,filter,center,programByBusiness]);
 const pins:DirectoryPin[]=filtered.map(e=>({...e,offerText:programPromise(programByBusiness.get(e.business_id))}));
 return <>
  <div className="discover-intro"><div><span className="eyebrow">TU PRÓXIMO LUGAR FAVORITO</span><h2>Descubre lugares que premian tus visitas</h2><p>Conoce su historia, descubre qué puedes ganar y guarda las tarjetas de los que más te gusten.</p></div></div>
  <div className="discover-top"><div className="search-box"><Search size={19}/><input aria-label="Buscar negocios" placeholder="Busca por negocio, recompensa o zona..." value={filter} onChange={e=>setFilter(e.target.value)}/></div>
   <button className="button button-outline" onClick={locate}><Navigation size={17}/>{hasLocation?"Actualizar ubicación":"Negocios cerca de mí"}</button></div>
  <div className="directory-filter-group"><strong>¿Qué te apetece descubrir?</strong><div className="chip-row">{categories.map(c=><button className={"filter-chip"+(category===c?" selected":"")} aria-pressed={category===c} key={c} onClick={()=>setCategory(c)}>{c!=="Todos"&&<StampMark kind={categoryStampKind(c)} size={18}/>} {c}</button>)}</div></div>
  <div className="directory-filter-group"><strong>Elige el tipo de recompensa</strong><div className="chip-row">{["Todos",...PROGRAM_TYPES.map(x=>x.id)].map(t=><button className={"filter-chip"+(rewardType===t?" selected":"")} key={t} aria-pressed={rewardType===t} onClick={()=>setRewardType(t)}>{t==="Todos"?"Todas":PROGRAM_TYPES.find(x=>x.id===t)?.label}</button>)}</div></div>
  {error&&<div className="alert error" role="alert">{error}</div>}
  <div className="directory-map directory-map-primary"><DirectoryMapView locations={pins} center={hasLocation?center:(filtered.length?[filtered[0].lat,filtered[0].lng]:TIJUANA)}/></div>
  <div className="content-heading spaced"><div><h2>{filtered.length} {filtered.length===1?"lugar para descubrir":"lugares para descubrir"}</h2><p>Explora el mapa o elige una tarjeta para conocer el negocio y su recompensa.</p></div></div>
  <div className="directory-results-grid">
   {filtered.length===0?<div className="empty-state compact"><Compass size={29}/><h3>Sin resultados</h3><p>Prueba con otro tipo de negocio o elimina algún filtro.</p></div>:
   filtered.map(e=>{const program=programByBusiness.get(e.business_id),cardId=myCards[e.business_id],already=!!cardId;return <article key={e.id} className="directory-card directory-card-rich directory-card-premium">
    <div className="directory-card-cover" style={{backgroundColor:e.businesses.accent_color||"#571c32"}}>
     <div className="directory-cover-pattern" aria-hidden="true"><span>LO</span><span>YA</span></div>
     <div className="directory-cover-top"><span className="directory-cover-category">{e.businesses.category||"Negocio local"}</span>{already&&<span className="joined-badge directory-joined"><Check size={13}/> Ya tienes tarjeta</span>}</div>
     <div className="directory-cover-brand">
      <span className="directory-cover-icon" style={{backgroundColor:/^#f{3,6}$/i.test(e.businesses.stamp_color||"")?"#571c32":"#fff"}}><StampMark kind={e.businesses.stamp_icon||categoryStampKind(e.businesses.category)} size={49} color={e.businesses.stamp_color||"#571c32"}/></span>
      {e.businesses.logo_url&&<img className="directory-brand-logo" src={e.businesses.logo_url} alt={"Logotipo de "+e.businesses.name}/>}
     </div>
     <strong className="directory-cover-business-name">{e.businesses.name}</strong>
    </div>
    <div className="directory-card-body">
     <div className="directory-card-heading"><strong>{e.businesses.name}</strong><span><Heart size={15}/></span></div>
     <p className="directory-business-description">{e.businesses.description||"Un lugar especial para descubrir, disfrutar y volver."}</p>
     <div className="directory-reward-highlight"><span><Gift size={16}/> TU RECOMPENSA</span><strong>{programPromise(program)}</strong></div>
     <p className="directory-location"><MapPin size={15}/><span>{e.address} · {e.city}, {e.country}</span></p>
     <div className="directory-card-footer">
      <span className="distance-tag">{distance(e)} km aprox.</span>
      <Link href={already?"/app":"/unirse/"+encodeURIComponent(e.businesses.slug)} className="button button-dark button-sm">{already?"Ver mi tarjeta":"Conseguir tarjeta"} <ArrowUpRight size={16}/></Link>
     </div>
     {already&&(wallets.apple||wallets.google)&&<div className="directory-wallet-links">
      {wallets.apple&&<a href={"/api/local/wallet/apple?card="+encodeURIComponent(cardId)}><Wallet size={16}/> Apple Wallet</a>}
      {wallets.google&&<a href={"/api/local/wallet/google?card="+encodeURIComponent(cardId)}><Wallet size={16}/> Google Wallet</a>}
     </div>}
    </div>
   </article>})}
  </div>
  <p className="tiny-note map-note">El mapa utiliza OpenStreetMap. La ubicación solo se consulta si lo autorizas en tu dispositivo.</p>
 </>;
}
export default function DiscoverPage(){return <AppFrame area="customer" title="Encuentra tu próxima recompensa" subtitle="Cada negocio tiene algo especial que ofrecerte.">{a=><Discover account={a}/>}</AppFrame>}
