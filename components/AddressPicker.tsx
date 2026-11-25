"use client";
import dynamic from "next/dynamic";
import {useEffect,useMemo,useState} from "react";
import {MapPin,Search,Check} from "lucide-react";
const AddressMap=dynamic(()=>import("@/components/AddressMap"),{ssr:false,loading:()=> <div className="lp-address-map-loading">Cargando mapa...</div>});

type Point={lat:number;lng:number};
type Props={
 address:string;city:string;country:string;lat:string;lng:string;
 onAddressChange:(x:string)=>void;onCityChange:(x:string)=>void;onCountryChange:(x:string)=>void;
 onCoordinatesChange:(lat:string,lng:string)=>void;
};
type Result={lat:number;lng:number;label:string;address?:string;city?:string;country?:string};
export function AddressPicker({address,city,country,lat,lng,onAddressChange,onCityChange,onCountryChange,onCoordinatesChange}:Props){
 const [loading,setLoading]=useState(false),[error,setError]=useState(""),[results,setResults]=useState<Result[]>([]);
 const [autocomplete,setAutocomplete]=useState(false),[typing,setTyping]=useState(false),[provider,setProvider]=useState("");
 useEffect(()=>{fetch("/api/local/geocode",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>setAutocomplete(!!d?.autocomplete)).catch(()=>{})},[]);
 useEffect(()=>{if(!autocomplete||!typing||address.trim().length<5)return;const controller=new AbortController();const timer=setTimeout(async()=>{try{const q=[address,city,country].filter(Boolean).join(", ");const r=await fetch("/api/local/geocode",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({q,autocomplete:true}),signal:controller.signal});if(r.ok){const d=await r.json();if(!controller.signal.aborted){setResults(d.results||[]);setProvider(d.provider||"")}}}catch{}},850);return()=>{clearTimeout(timer);controller.abort()}},[address,city,country,typing,autocomplete]);
 const point=useMemo(()=>{
  const x=Number(lat),y=Number(lng);
  return lat.trim()&&lng.trim()&&Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<=90&&Math.abs(y)<=180?{lat:x,lng:y}:null;
 },[lat,lng]);
 function choose(next:Point){
  onCoordinatesChange(String(Number(next.lat.toFixed(7))),String(Number(next.lng.toFixed(7))));
 }
 function selectResult(r:Result){setTyping(false);if(r.address)onAddressChange(r.address);if(r.city)onCityChange(r.city);if(r.country)onCountryChange(r.country);choose(r);setResults([])}
 function clearPoint(){setResults([]);setTyping(true);if(lat||lng)onCoordinatesChange("","");}
 async function search(){setTyping(false);setError("");setResults([]);
  const q=[address,city,country].filter(Boolean).join(", ").trim();
  if(q.length<7){setError("Escribe la dirección y la ciudad.");return}
  setLoading(true);
  try{
   const r=await fetch("/api/local/geocode",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({q}),cache:"no-store"});
   const d=await r.json() as {results?:Result[];error?:string;provider?:string};
   if(!r.ok)throw new Error(d.error||"No se encontró la dirección.");
   setResults(d.results||[]);setProvider(d.provider||"");
   if(!d.results?.length)setError("No encontramos esa dirección. Prueba con una calle cercana o coloca el pin en el mapa.");
   else if(d.results.length===1)selectResult(d.results[0]);
  }catch(e){setError((e as Error).message)}finally{setLoading(false)}
 }
 return <div className="lp-address-picker">
  <div className="lp-address-search">
   <div className="form-stack">
    <label>Dirección<input required minLength={4} value={address} onChange={e=>{onAddressChange(e.target.value);clearPoint()}} placeholder="Calle, número y colonia"/></label>
    <div className="form-two">
     <label>Ciudad<input required value={city} onChange={e=>{onCityChange(e.target.value);clearPoint()}} placeholder="Ciudad"/></label>
     <label>País<input required value={country} onChange={e=>{onCountryChange(e.target.value);clearPoint()}} placeholder="País"/></label>
    </div>
    <button type="button" className="button button-outline" onClick={()=>void search()} disabled={loading}><Search size={17}/>{loading?"Buscando...":"Buscar dirección en el mapa"}</button>
   </div>
  </div>
  {error&&<div className="alert error" role="alert">{error}</div>}
  {results.length>0&&<div className="lp-address-results" role="listbox" aria-label="Direcciones encontradas">{results.map((r,i)=><button type="button" role="option" aria-selected={point?.lat===r.lat&&point?.lng===r.lng} key={i} onClick={()=>selectResult(r)}><MapPin size={17}/><span>{r.label}</span></button>)}</div>}
  <div className="address-provider-help"><a href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent([address,city,country].filter(Boolean).join(", "))} target="_blank" rel="noopener noreferrer">Comprobar dirección en Google Maps</a>{provider==="geoapify"&&<small>Resultados de <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> y OpenStreetMap</small>}</div>
  <AddressMap point={point} onChange={next=>{setTyping(false);setResults([]);choose(next)}}/>
  <div className={"lp-address-map-caption"+(point?" selected":"")}><span><MapPin size={16}/>{point?"Ubicación seleccionada":"Selecciona la ubicación del local"}</span><small>{point?"Puedes mover el pin si la posición no es exacta.":"Busca la dirección, pulsa sobre el mapa o arrastra el pin."}</small>{point&&<Check size={17}/>}</div>
 </div>;
}
