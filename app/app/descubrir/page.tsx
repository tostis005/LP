"use client";
import {useEffect,useMemo,useState} from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import {Compass,MapPin,Navigation,Search,ArrowUpRight,Check,Star} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {db} from "@/lib/supabase";
import type {Location,Business} from "@/lib/types";
import {initials} from "@/lib/format";
type Entry=Location&{businesses:Business};
const Map=dynamic(()=>import("@/components/DirectoryMap"),{ssr:false,loading:()=> <div className="map-placeholder">Cargando mapa...</div>});
function Discover({account}:{account:Account}){
 const [entries,setEntries]=useState<Entry[]>([]),[memberIds,setMemberIds]=useState<string[]>([]),[filter,setFilter]=useState(""),[category,setCategory]=useState("Todos"),[center,setCenter]=useState<[number,number]>([40.4168,-3.7038]),[hasLocation,setHasLocation]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState("");
 useEffect(()=>{async function load(){const [loc,members]=await Promise.all([db().from("business_locations").select("*,businesses(*)").eq("visible",true),db().from("loyalty_memberships").select("business_id").eq("customer_id",account.user.id)]);
  if(loc.error)setError(loc.error.message);else setEntries((loc.data||[]) as Entry[]);
  setMemberIds(((members.data||[]) as {business_id:string}[]).map(x=>x.business_id));
 }load()},[account.user.id]);
 function locate(){if(!navigator.geolocation){setError("Tu navegador no admite geolocalización.");return}
 navigator.geolocation.getCurrentPosition(p=>{setCenter([p.coords.latitude,p.coords.longitude]);setHasLocation(true);setError("")},()=>setError("No se ha podido obtener tu ubicación. Puedes buscar por nombre o ciudad."),{enableHighAccuracy:false,timeout:8000})}
 const categories=["Todos",...new Set(entries.map(e=>e.businesses?.category).filter(Boolean) as string[])];
 const distance=(e:Entry)=>{const [a,b]=center;const deg=Math.PI/180;const x=(e.lng-b)*Math.cos((a+e.lat)/2*deg);const y=e.lat-a;return Math.round(Math.sqrt(x*x+y*y)*111.2)};
 const filtered=useMemo(()=>entries.filter(e=>e.businesses?.active&&e.businesses?.public_listing&&(category==="Todos"||e.businesses?.category===category)&&[e.businesses?.name,e.name,e.city,e.country,e.address].join(" ").toLocaleLowerCase().includes(filter.toLocaleLowerCase())).sort((a,b)=>distance(a)-distance(b)),[entries,category,filter,center]);
 async function join(e:Entry){setBusy(e.business_id);setError("");
 const {error}=await db().rpc("join_program",{p_business:e.business_id});if(error)setError(error.message);else setMemberIds(v=>[...v,e.business_id]);setBusy("")}
 return <><div className="discover-top"><div className="search-box"><Search size={19}/><input placeholder="Buscar cafeterías, barberías, ciudades..." value={filter} onChange={e=>setFilter(e.target.value)}/></div><button className="button button-outline" onClick={locate}><Navigation size={17}/>{hasLocation?"Ubicación actual":"Usar mi ubicación"}</button></div>
 <div className="chip-row">{categories.map(c=><button className={"filter-chip"+(category===c?" selected":"")} key={c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
 {error&&<div className="alert error">{error}</div>}
 <div className="directory-layout"><div className="directory-list"><div className="small-heading"><strong>{filtered.length} ubicaciones para descubrir</strong><span>Ordenadas por distancia al centro del mapa</span></div>
 {filtered.length===0?<div className="empty-state compact"><Compass size={29}/><h3>No hay negocios en esta búsqueda</h3><p>Prueba otra ciudad o categoría.</p></div>:filtered.map(e=><article key={e.id} className="directory-card"><div className="directory-logo" style={{background:e.businesses?.accent_color||"#264d3e"}}>{e.businesses?.logo_url?<img src={e.businesses.logo_url} alt=""/>:initials(e.businesses?.name||"Negocio")}</div><div className="directory-card-body"><div className="directory-card-heading"><strong>{e.businesses?.name}</strong>{memberIds.includes(e.business_id)&&<span className="joined-badge"><Check size={13}/> Unido</span>}</div><small>{e.businesses?.category||"Negocio local"}</small><p><MapPin size={14}/>{e.address} · {e.city}, {e.country}</p><span className="distance-tag">{distance(e)} km aprox. del centro del mapa</span><div className="directory-card-actions">{memberIds.includes(e.business_id)?<a className="text-link" href="/app">Ver mi tarjeta <ArrowUpRight size={15}/></a>:<button disabled={busy===e.business_id} className="button button-dark button-sm" onClick={()=>join(e)}>{busy===e.business_id?"Uniéndote...":"Unirme al programa"} <ArrowUpRight size={15}/></button>}</div></div></article>)}
 </div><div className="directory-map"><Map locations={filtered} center={filtered.length&&(!hasLocation)?[filtered[0].lat,filtered[0].lng]:center}/></div></div>
 <p className="tiny-note map-note">El mapa usa OpenStreetMap. Solo solicitamos tu ubicación con tu permiso; no se almacena en tu perfil. Si no la compartes, mostramos negocios según la búsqueda o la vista del mapa.</p>
 </>}
export default function DiscoverPage(){return <AppFrame area="customer" title="Descubre algo nuevo" subtitle="Negocios cerca de ti con ventajas por volver.">{a=><Discover account={a}/>}</AppFrame>}
