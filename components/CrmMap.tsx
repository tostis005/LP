"use client";
import {useEffect,useState} from "react";
import {MapContainer,TileLayer,CircleMarker,Popup,useMap} from "react-leaflet";
import "leaflet/dist/leaflet.css";
type Point={id:string;name:string;address:string;category:string;lat:number;lng:number};
function Fit({points}:{points:Point[]}){const map=useMap();useEffect(()=>{if(points.length)map.fitBounds(points.map(p=>[p.lat,p.lng] as [number,number]),{padding:[24,24],maxZoom:15});},[map,points]);return null;}
export default function CrmMap({query}:{query:string}){
 const [points,setPoints]=useState<Point[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{const c=new AbortController();setLoading(true);setPoints([]);setError("");fetch("/api/local/admin/crm?view=map&"+query,{signal:c.signal,cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);if(!c.signal.aborted){setPoints(j.points);setTotal(j.total);}}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[query]);
 return <section style={{margin:"12px 0",borderRadius:16,overflow:"hidden",position:"relative",zIndex:0}}>{loading?<p>Cargando ubicaciones…</p>:error?<p role="alert">{error}</p>:<><p className="muted">{points.length.toLocaleString("es-MX")} de {total.toLocaleString("es-MX")} negocios con coordenadas. {total>5000?"Acota los filtros para ver más detalle.":""}</p>{points.length>0&&<MapContainer center={[points[0].lat,points[0].lng]} zoom={12} preferCanvas style={{height:420,width:"100%"}}><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Fit points={points}/>{points.map(p=><CircleMarker key={p.id} center={[p.lat,p.lng]} radius={6} pathOptions={{color:"#a9213d",fillOpacity:0.8}}><Popup><strong>{p.name}</strong><br/>{p.category}<br/>{p.address}</Popup></CircleMarker>)}</MapContainer>}</>}</section>;
}