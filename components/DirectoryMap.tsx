"use client";
import {MapContainer,TileLayer,Marker,useMap,useMapEvents} from "react-leaflet";
import {divIcon} from "leaflet";
import {useEffect,useMemo} from "react";
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
function pinIcon(hasCard:boolean,selected=false){
 const star='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="25" height="25" aria-hidden="true" fill="'+(hasCard?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m12 2.8 2.85 5.8 6.4.93-4.63 4.52 1.1 6.38L12 17.4l-5.72 3.03 1.1-6.38-4.63-4.52 6.4-.93L12 2.8Z"/></svg>';
 return divIcon({
  className:"loyally-map-marker",
  html:'<span class="loyally-map-pin '+(hasCard?'is-owned':'is-unowned')+(selected?' is-selected':'')+'"><span class="loyally-map-symbol">'+star+'</span></span>',
  iconSize:[46,53],iconAnchor:[23,52],popupAnchor:[0,-48]
 });
}
/** El marcador selecciona el negocio; no abre un segundo popup de Leaflet. */
function Pins({locations,onSelect,selectedId}:{locations:DirectoryPin[];onSelect?:(pin:DirectoryPin)=>void;selectedId?:string|null}){
 const icons=useMemo(()=>new Map(locations.map(l=>[l.id,pinIcon(Boolean(l.hasCard),l.id===selectedId)])),[locations,selectedId]);
 return <>{locations.map(x=><Marker key={x.id} position={[x.lat,x.lng]} icon={icons.get(x.id)!}
  title={x.businesses?.name||x.name} bubblingMouseEvents={false}
  eventHandlers={{click:()=>onSelect?.(x)}}/>)}</>;
}
function DismissOnMapClick({onDismiss}:{onDismiss?:()=>void}){
 useMapEvents({click:()=>onDismiss?.()});
 return null;
}
export default function DirectoryMap({locations,center,onSelect,selectedId,onDismiss}:{locations:DirectoryPin[];center:[number,number];onSelect?:(pin:DirectoryPin)=>void;selectedId?:string|null;onDismiss?:()=>void}){
 return <MapContainer center={center} zoom={11} scrollWheelZoom={false} style={{height:"100%",width:"100%",borderRadius:18}}>
  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
  <Recenter center={center}/>
  <DismissOnMapClick onDismiss={onDismiss}/>
  <Pins locations={locations} onSelect={onSelect} selectedId={selectedId}/>
 </MapContainer>;
}
