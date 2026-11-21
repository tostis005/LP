"use client";
import {MapContainer,TileLayer,Marker,Popup,useMap} from "react-leaflet";
import {divIcon} from "leaflet";
import {useEffect,useMemo} from "react";
import Link from "next/link";
import type {Location} from "@/lib/types";

export type DirectoryPin=Omit<Location,"businesses">&{
 businesses?:{name:string;category:string|null;slug:string;accent_color?:string;description?:string|null;stamp_icon?:string|null;stamp_color?:string|null};
 offerText?:string;
 hasCard?:boolean;
 cardId?:string;
};
function Recenter({center}:{center:[number,number]}){
 const map=useMap();
 useEffect(()=>{map.setView(center,Math.max(map.getZoom(),11))},[center,map]);
 return null;
}
/** Marcador independiente de la categoría: estrella rellena = tarjeta guardada. */
function pinIcon(hasCard:boolean){
 const star='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="25" height="25" aria-hidden="true" fill="'+(hasCard?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m12 2.8 2.85 5.8 6.4.93-4.63 4.52 1.1 6.38L12 17.4l-5.72 3.03 1.1-6.38-4.63-4.52 6.4-.93L12 2.8Z"/></svg>';
 return divIcon({
  className:"loyally-map-marker",
  html:'<span class="loyally-map-pin '+(hasCard?'is-owned':'is-unowned')+'"><span class="loyally-map-symbol">'+star+'</span></span>',
  iconSize:[46,53],iconAnchor:[23,52],popupAnchor:[0,-48]
 });
}
function Pins({locations}:{locations:DirectoryPin[]}){
 const icons=useMemo(()=>new Map(locations.map(l=>[l.id,pinIcon(Boolean(l.hasCard))])),[locations]);
 return <>{locations.map(x=><Marker key={x.id} position={[x.lat,x.lng]} icon={icons.get(x.id)!}>
  <Popup>
   <div className="loyally-map-popup">
    <strong>{x.businesses?.name||x.name}</strong>
    <small>{x.businesses?.category||"Negocio local"}</small>
    <span className={"loyally-map-status"+(x.hasCard?" is-owned":"")}>{x.hasCard?"★ Ya tienes su tarjeta":"☆ Aún no tienes su tarjeta"}</span>
    {x.businesses?.description&&<p>{x.businesses.description}</p>}
    {x.offerText&&<div className="loyally-map-reward">{x.offerText}</div>}
    <div className="loyally-map-address">{x.address}, {x.city}</div>
    <Link href={x.cardId?"/app?card="+encodeURIComponent(x.cardId):"/unirse/"+encodeURIComponent(x.businesses?.slug||"")}>{x.hasCard?"Ver mi tarjeta":"Conocer el negocio y su tarjeta"}</Link>
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
