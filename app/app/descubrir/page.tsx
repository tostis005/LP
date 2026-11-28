"use client";
import {useEffect,useMemo,useState} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import {Compass,MapPin,Navigation,Search,ArrowUpRight,Check,Gift,SlidersHorizontal,X} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {StampMark} from "@/components/StampMarks";
import {db} from "@/lib/supabase";
import type {Location,Business,Program,Membership} from "@/lib/types";
import {MerchantCard} from "@/components/StampCard";
import {LoyaltyCard} from "@/components/LoyaltyCard";
import {publicJoinUrl} from "@/lib/public-url";
import {logoImageUrl} from "@/lib/asset-images";
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
 const [membersById,setMembersById]=useState<Record<string,Membership>>({});
 const [openCardId,setOpenCardId]=useState<string|null>(null);
 const [filter,setFilter]=useState(""),[category,setCategory]=useState("Todos"),[rewardType,setRewardType]=useState("Todos"),[selectedId,setSelectedId]=useState<string|null>(null),[filtersOpen,setFiltersOpen]=useState(false);
 const [center,setCenter]=useState<[number,number]>(TIJUANA),[hasLocation,setHasLocation]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{async function load(){
  const [loc,members,p]=await Promise.all([
   db().from("business_locations").select("*,businesses(*)").eq("visible",true),
   db().from("loyalty_memberships").select("id,business_id,customer_id,balance,total_earned,created_at,card_token,customer_favorite,customer_hidden").eq("customer_id",account.user.id),
   db().from("loyalty_programs").select("*")
  ]);
  if(loc.error)setError(loc.error.message);else setEntries((loc.data||[]) as Entry[]);
  if(p.error)setError(p.error.message);else setPrograms((p.data||[]) as Program[]);
  const owned=(members.data||[]) as Membership[];
  setMyCards(Object.fromEntries(owned.filter(x=>!x.customer_hidden).map(x=>[x.business_id,x.id])));
  setMembersById(Object.fromEntries(owned.map(x=>[x.id,x])));
 }load()},[account.user.id]);
 useEffect(()=>{const listener=(event:Event)=>{const {id,...patch}=(event as CustomEvent<{id:string;customer_favorite?:boolean;customer_hidden?:boolean}>).detail;setMembersById(prev=>{const m=prev[id];return m?{...prev,[id]:{...m,...patch}}:prev;});};window.addEventListener("kreyvi:card-display-changed",listener);return()=>window.removeEventListener("kreyvi:card-display-changed",listener);},[]);
 useEffect(()=>{setMyCards(Object.fromEntries(Object.values(membersById).filter(x=>!x.customer_hidden).map(x=>[x.business_id,x.id])));},[membersById]);
 const hiddenBusinesses=new Set(Object.values(membersById).filter(x=>x.customer_hidden).map(x=>x.business_id));
 function locate(){
  if(!navigator.geolocation){setError("Tu navegador no puede consultar la ubicación.");return}
  navigator.geolocation.getCurrentPosition(p=>{setCenter([p.coords.latitude,p.coords.longitude]);setHasLocation(true);setError("")},
   ()=>setError("No hemos podido conocer tu ubicación. Seguimos mostrando los negocios disponibles."),{enableHighAccuracy:false,timeout:8000});
 }
 useEffect(()=>{setSelectedId(null)},[filter,category,rewardType]);
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
 const pins:DirectoryPin[]=filtered.map(e=>({...e,hasCard:Boolean(myCards[e.business_id]),cardId:myCards[e.business_id],offerText:programPromise(programByBusiness.get(e.business_id))}));
 // Una pulsación en un marcador no debe recentrar el mapa y perder la posición del usuario.
 const mapCenter=useMemo<[number,number]>(()=>hasLocation?center:filtered.length?[filtered[0].lat,filtered[0].lng]:TIJUANA,[hasLocation,center,filtered[0]?.lat,filtered[0]?.lng]);
 const selected=selectedId?filtered.find(entry=>entry.id===selectedId)||null:null;
 const selectedCard=selected?myCards[selected.business_id]:null;
 const selectedProgram=selected?programByBusiness.get(selected.business_id):undefined;
 const viewingMembership=openCardId?membersById[openCardId]:undefined;
 const viewingBusiness=viewingMembership?entries.find(e=>e.business_id===viewingMembership.business_id)?.businesses:undefined;
 return <>
  {error&&<div className="alert error" role="alert">{error}</div>}
  <div className="customer-discover-tools">
   <div className="customer-map-search">
    <Search size={19}/><input aria-label="Buscar negocios" placeholder="Busca cafés, panaderías, restaurantes..." value={filter} onChange={e=>setFilter(e.target.value)}/>
    {filter&&<button type="button" onClick={()=>setFilter("")} aria-label="Borrar búsqueda"><X size={18}/></button>}
   </div>
   <div className="customer-discover-filterbar">
    <div className="customer-discover-filter-header">
     <span className="customer-discover-filter-label">Categorías</span>
     <button type="button" className={"customer-filter-toggle"+(filtersOpen||rewardType!=="Todos"?" active":"")} aria-expanded={filtersOpen} aria-controls="discover-reward-filters" onClick={()=>setFiltersOpen(open=>!open)}><SlidersHorizontal size={17}/> Filtros{rewardType!=="Todos"?" · 1":""}</button>
    </div>
    <div className="customer-map-categories" role="group" aria-label="Categorías de negocios">{categories.map(c=><button key={c} type="button" className={"filter-chip"+(category===c?" selected":"")} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c!=="Todos"&&<StampMark kind={categoryStampKind(c)} size={16}/>} {c}</button>)}</div>
   </div>
   {filtersOpen&&<div id="discover-reward-filters" className="customer-map-filter-panel">
    <label>Tipo de recompensa <select aria-label="Tipo de recompensa" value={rewardType} onChange={e=>setRewardType(e.target.value)}>{["Todos",...PROGRAM_TYPES.map(x=>x.id)].map(t=><option key={t} value={t}>{t==="Todos"?"Todas":PROGRAM_TYPES.find(x=>x.id===t)?.label}</option>)}</select></label>
    {rewardType!=="Todos"&&<button type="button" onClick={()=>setRewardType("Todos")}>Limpiar</button>}
   </div>}
   <div className="customer-map-legend-row">
    <div className="directory-map-legend" aria-label="Significado de las estrellas">
     <span><span className="map-legend-star filled" aria-hidden="true">★</span> Ya tengo tarjeta</span>
     <span><span className="map-legend-star outline" aria-hidden="true">☆</span> Aún no la tengo</span>
    </div>
    <span className="customer-map-result-count">{filtered.length} {filtered.length===1?"lugar":"lugares"}</span>
   </div>
  </div>
  <section className="customer-map-stage" aria-label="Explorar negocios en el mapa">
   <div className="directory-map directory-map-primary"><DirectoryMapView locations={pins} onSelect={pin=>setSelectedId(pin.id)} selectedId={selectedId} onDismiss={()=>setSelectedId(null)} center={mapCenter}/></div>
   <button type="button" className="customer-map-locate" onClick={locate} aria-label={hasLocation?"Actualizar mi ubicación":"Encontrar negocios cerca de mí"} title="Mi ubicación"><Navigation size={20}/></button>
   {selected&&<article className="customer-map-business-card" aria-label={"Negocio seleccionado: "+selected.businesses.name}>
    <button type="button" className="customer-map-card-close" onClick={()=>setSelectedId(null)} aria-label="Cerrar ficha del negocio"><X size={18}/></button>
    <div className="customer-map-business-heading">
     <div className="customer-map-business-icon" style={{backgroundColor:selected.businesses.accent_color||"#7c2944"}}>
      {selected.businesses.logo_url?<img src={logoImageUrl(selected.businesses.logo_url,96)} alt="" loading="lazy" decoding="async"/>:<StampMark kind={selected.businesses.stamp_icon||categoryStampKind(selected.businesses.category)} size={29} color={selected.businesses.stamp_color||"#fff"}/>}
     </div>
     <div className="customer-map-business-name"><h2>{selected.businesses.name}</h2><span>{selected.businesses.category||"Negocio local"} · {hasLocation?distance(selected)+" km aprox.":selected.city}</span></div>
     <span className={"customer-map-ownership"+(selectedCard?" owned":"")}>{selectedCard?"La tengo":hiddenBusinesses.has(selected.business_id)?"Retirada":"Me falta"}</span>
    </div>
    <p className="customer-map-business-reward">{programPromise(selectedProgram)}</p>
    <div className="customer-map-business-actions">
     {selectedCard?
      <button type="button" className="customer-map-primary-action" onClick={()=>setOpenCardId(selectedCard)}>Ver tarjeta</button>:
      <Link href={"/unirse/"+encodeURIComponent(selected.businesses.slug)} className="customer-map-primary-action">{hiddenBusinesses.has(selected.business_id)?"Recuperar tarjeta":"Añadir tarjeta"}</Link>}
     <a className="customer-map-secondary-action" href={"https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(selected.lat+","+selected.lng)} target="_blank" rel="noopener noreferrer"><Navigation size={16}/> Cómo llegar</a>
    </div>
   </article>}
  </section>
  <div className="customer-discover-results-heading"><h2>Negocios disponibles</h2><span>{filtered.length} {filtered.length===1?"resultado":"resultados"}</span></div>
  <div className="directory-results-grid">
   {filtered.length===0?<div className="empty-state compact"><Compass size={29}/><h3>Sin resultados</h3><p>Prueba con otro tipo de negocio o elimina algún filtro.</p></div>:
   filtered.map(e=>{const program=programByBusiness.get(e.business_id),cardId=myCards[e.business_id],already=!!cardId;return <article key={e.id} className="directory-card directory-card-rich directory-card-premium">
    <div className="directory-merchant-card"><MerchantCard business={e.businesses} program={program} balance={cardId?membersById[cardId]?.balance||0:0} qrValue={cardId&&membersById[cardId]?.card_token?"https://kreyvi.com/t/"+membersById[cardId].card_token:publicJoinUrl(e.businesses.slug)}/>{already&&<span className="directory-merchant-owned"><Check size={13}/> Ya tienes tarjeta</span>}</div>
    <div className="directory-card-body">
     <div className="directory-card-heading"><strong>{e.businesses.name}</strong></div>
     {e.businesses.description&&<p className="directory-business-description">{e.businesses.description}</p>}
     <div className="directory-reward-highlight"><span><Gift size={16}/> Recompensa</span><strong>{programPromise(program)}</strong></div>
     <p className="directory-location"><MapPin size={15}/><span>{e.address} · {e.city}, {e.country}</span></p>
     <div className="directory-card-footer">
      {hasLocation&&<span className="distance-tag">{distance(e)} km aprox.</span>}
      {already?<button type="button" onClick={()=>setOpenCardId(cardId)} className="button button-dark button-sm">Ver tarjeta <ArrowUpRight size={16}/></button>:
        <Link href={"/unirse/"+encodeURIComponent(e.businesses.slug)} className="button button-dark button-sm">{hiddenBusinesses.has(e.business_id)?"Recuperar tarjeta":"Conseguir tarjeta"} <ArrowUpRight size={16}/></Link>}
     </div>
    </div>
   </article>})}
  </div>
  {viewingMembership&&viewingBusiness&&<LoyaltyCard key={viewingMembership.id} membership={viewingMembership} business={viewingBusiness} program={programByBusiness.get(viewingMembership.business_id)} autoOpen modalOnly onClose={()=>setOpenCardId(null)}/>}
 </>;
}
export default function DiscoverPage(){return <AppFrame area="customer" title="Descubrir negocios" subtitle="">{a=><Discover account={a}/>}</AppFrame>}
