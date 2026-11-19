"use client";
import {useEffect,useMemo,useState} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import {Compass,MapPin,Navigation,Search,ArrowUpRight,Check} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {db} from "@/lib/supabase";
import type {Location,Business,ProgramType} from "@/lib/types";
import {BUSINESS_CATEGORIES,PROGRAM_TYPES,categoryIcon} from "@/lib/business-categories";
import {initials} from "@/lib/format";
type Entry=Location&{businesses:Business;visible?:boolean};
type ProgramChoice={business_id:string;type:ProgramType;reward_label?:string};
const DirectoryMapView=dynamic(()=>import("@/components/DirectoryMap"),{ssr:false,loading:()=> <div className="map-placeholder">Cargando mapa...</div>});
const TIJUANA:[number,number]=[32.5234,-117.0382];
function Discover({account}:{account:Account}){
 const [entries,setEntries]=useState<Entry[]>([]);
 const [programs,setPrograms]=useState<ProgramChoice[]>([]);
 const [memberIds,setMemberIds]=useState<string[]>([]);
 const [filter,setFilter]=useState(""),[category,setCategory]=useState("Todos"),[rewardType,setRewardType]=useState("Todos");
 const [center,setCenter]=useState<[number,number]>(TIJUANA),[hasLocation,setHasLocation]=useState(false);
 const [error,setError]=useState(""),[busy,setBusy]=useState("");
 useEffect(()=>{async function load(){
  const [loc,members,p]=await Promise.all([
   db().from("business_locations").select("*,businesses(*)").eq("visible",true),
   db().from("loyalty_memberships").select("business_id").eq("customer_id",account.user.id),
   db().from("loyalty_programs").select("business_id,type,reward_label")
  ]);
  if(loc.error)setError(loc.error.message);else setEntries((loc.data||[]) as Entry[]);
  if(p.error)setError(p.error.message);else setPrograms((p.data||[]) as ProgramChoice[]);
  setMemberIds(((members.data||[]) as {business_id:string}[]).map(x=>x.business_id));
 }load()},[account.user.id]);
 function locate(){
  if(!navigator.geolocation){setError("Tu navegador no admite geolocalización.");return}
  navigator.geolocation.getCurrentPosition(p=>{setCenter([p.coords.latitude,p.coords.longitude]);setHasLocation(true);setError("")},
   ()=>setError("No hemos podido conocer tu ubicación. Seguimos mostrando Tijuana."),{enableHighAccuracy:false,timeout:8000});
 }
 const categories=["Todos",...BUSINESS_CATEGORIES.map(x=>x.name).filter(x=>entries.some(e=>e.businesses?.category===x))];
 const programByBusiness=useMemo(()=>new Map(programs.map(p=>[p.business_id,p])),[programs]);
 const distance=(e:Entry)=>{const [a,b]=center,deg=Math.PI/180;const x=(e.lng-b)*Math.cos((a+e.lat)/2*deg),y=e.lat-a;return Math.round(Math.sqrt(x*x+y*y)*111.2*10)/10};
 const filtered=useMemo(()=>entries.filter(e=>
  e.businesses?.active&&e.businesses?.public_listing&&
  (category==="Todos"||e.businesses?.category===category)&&
  (rewardType==="Todos"||programByBusiness.get(e.business_id)?.type===rewardType)&&
  [e.businesses?.name,e.name,e.city,e.country,e.address].join(" ").toLocaleLowerCase().includes(filter.toLocaleLowerCase())
 ).sort((a,b)=>distance(a)-distance(b)),[entries,category,rewardType,filter,center,programByBusiness]);
 async function join(e:Entry){
  setBusy(e.business_id);setError("");
  const {error}=await db().rpc("join_program",{p_business:e.business_id});
  if(error)setError(error.message);else setMemberIds(v=>[...new Set([...v,e.business_id])]);
  setBusy("");
 }
 return <>
  <div className="discover-top"><div className="search-box"><Search size={19}/><input aria-label="Buscar negocios" placeholder="Buscar en Tijuana, por nombre o por zona..." value={filter} onChange={e=>setFilter(e.target.value)}/></div>
   <button className="button button-outline" onClick={locate}><Navigation size={17}/>{hasLocation?"Actualizar ubicación":"Negocios cerca de mí"}</button></div>
  <div className="directory-filter-group"><strong>Tipo de negocio</strong><div className="chip-row">{categories.map(c=><button className={"filter-chip"+(category===c?" selected":"")} aria-pressed={category===c} key={c} onClick={()=>setCategory(c)}>{c!=="Todos"&&<span aria-hidden="true">{categoryIcon(c)} </span>}{c}</button>)}</div></div>
  <div className="directory-filter-group"><strong>Tipo de recompensa</strong><div className="chip-row">{["Todos",...PROGRAM_TYPES.map(x=>x.id)].map(t=><button className={"filter-chip"+(rewardType===t?" selected":"")} key={t} aria-pressed={rewardType===t} onClick={()=>setRewardType(t)}>{t==="Todos"?"Todas las recompensas":PROGRAM_TYPES.find(x=>x.id===t)?.label}</button>)}</div></div>
  {error&&<div className="alert error" role="alert">{error}</div>}
  <div className="directory-map directory-map-primary"><DirectoryMapView locations={filtered} center={hasLocation?center:(filtered.length?[filtered[0].lat,filtered[0].lng]:TIJUANA)}/></div>
  <div className="content-heading spaced"><div><h2>{filtered.length} negocios para descubrir</h2><p>Ordenados por distancia {hasLocation?"a tu ubicación":"al centro de Tijuana"}. El mapa y el listado comparten los filtros.</p></div></div>
  <div className="directory-results-grid">
   {filtered.length===0?<div className="empty-state compact"><Compass size={29}/><h3>Sin resultados</h3><p>Cambia alguno de los filtros para ver más negocios.</p></div>:
   filtered.map(e=>{const program=programByBusiness.get(e.business_id);return <article key={e.id} className="directory-card">
    <div className="directory-logo" style={{background:e.businesses.accent_color||"#264d3e"}}>{e.businesses.logo_url?<img src={e.businesses.logo_url} alt=""/>:initials(e.businesses.name)}</div>
    <div className="directory-card-body"><div className="directory-card-heading"><strong>{e.businesses.name}</strong>{memberIds.includes(e.business_id)&&<span className="joined-badge"><Check size={13}/> Ya tienes tarjeta</span>}</div>
    <small>{categoryIcon(e.businesses.category)} {e.businesses.category||"Negocio local"} · {PROGRAM_TYPES.find(x=>x.id===program?.type)?.label||"Fidelización"}</small>
    <p><MapPin size={14}/>{e.address} · {e.city}, {e.country}</p>
    <span className="distance-tag">{distance(e)} km aprox.</span>
    {program?.reward_label&&<div className="directory-reward">{program.reward_label}</div>}
    <div className="directory-card-actions">{memberIds.includes(e.business_id)?
     <Link className="text-link" href="/app">Ver mi tarjeta <ArrowUpRight size={15}/></Link>:
     <button disabled={busy===e.business_id} className="button button-dark button-sm" onClick={()=>join(e)}>{busy===e.business_id?"Añadiendo...":"Conseguir tarjeta"} <ArrowUpRight size={15}/></button>}
    </div></div>
   </article>})}
  </div>
  <p className="tiny-note map-note">Mapa de OpenStreetMap. Los 10 negocios iniciales y sus direcciones son ficticios y sirven para probar la experiencia en Tijuana. Tu ubicación solo se solicita con permiso y no se guarda en el perfil. Los espacios promocionados podrán identificarse claramente en el futuro.</p>
 </>;
}
export default function DiscoverPage(){return <AppFrame area="customer" title="Descubre negocios en Tijuana" subtitle="Encuentra una recompensa cerca de ti y guarda su tarjeta en un toque.">{a=><Discover account={a}/>}</AppFrame>}
