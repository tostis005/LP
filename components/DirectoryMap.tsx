"use client";
import {MapContainer,TileLayer,Marker,Popup,useMap} from "react-leaflet";
import {divIcon} from "leaflet";
import {useEffect,useMemo} from "react";
import Link from "next/link";
import type {Location} from "@/lib/types";
import {categoryStampKind} from "@/lib/business-categories";
import {stampMarkup} from "@/lib/stamp-drawings";

export type DirectoryPin=Omit<Location,"businesses">&{
 businesses?:{name:string;category:string|null;slug:string;accent_color?:string;description?:string|null;stamp_icon?:string|null;stamp_color?:string|null};
 offerText?:string;
};
function Recenter({center}:{center:[number,number]}){
 const map=useMap();
 useEffect(()=>{map.setView(center,Math.max(map.getZoom(),11))},[center,map]);
 return null;
}
function pinIcon(category?:string|null,stampKind?:string|null,stampColor?:string|null,accent?:string){
 // No se usa transform en el marcador exterior: Leaflet necesita controlarlo
 // para situar el icono. Solo el diseño interno contiene el color y el dibujo.
 const color=/^#[0-9a-f]{6}$/i.test(stampColor||"")?stampColor!:/^#[0-9a-f]{6}$/i.test(accent||"")?accent!:"#571c32";
 const svg=stampMarkup(stampKind||categoryStampKind(category),31);
 return divIcon({
  className:"loyally-map-marker",
  html:'<span class="loyally-map-pin"><span class="loyally-map-symbol" style="color:'+color+'">'+svg+'</span></span>',
  iconSize:[46,53],iconAnchor:[23,52],popupAnchor:[0,-48]
 });
}
function Pins({locations}:{locations:DirectoryPin[]}){
 const icons=useMemo(()=>new Map(locations.map(l=>[l.id,pinIcon(l.businesses?.category,l.businesses?.stamp_icon,l.businesses?.stamp_color,l.businesses?.accent_color)])),[locations]);
 return <>{locations.map(x=><Marker key={x.id} position={[x.lat,x.lng]} icon={icons.get(x.id)!}>
  <Popup>
   <div className="loyally-map-popup">
    <strong>{x.businesses?.name||x.name}</strong>
    <small>{x.businesses?.category||"Negocio local"}</small>
    {x.businesses?.description&&<p>{x.businesses.description}</p>}
    {x.offerText&&<div className="loyally-map-reward">{x.offerText}</div>}
    <div className="loyally-map-address">{x.address}, {x.city}</div>
    <Link href={"/unirse/"+encodeURIComponent(x.businesses?.slug||"")}>Conocer el negocio y su tarjeta</Link>
   </div>
  </Popup>
 </Marker>)}</>;
}
export default function DirectoryMap({locations,center}:{locations:DirectoryPin[];center:[number,number]}){
 return <MapContainer center={center} zoom={11} scrollWheelZoom={false} style={{height:"100%",width:"100%",borderRadius:18}}>
  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
  <Recenter center={center}/>
  <Pins locations={locations}/>
 </MapContainer>;
}
