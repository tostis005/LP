"use client";
import {MapContainer,TileLayer,Marker,Popup,useMap} from "react-leaflet";
import {divIcon} from "leaflet";
import {useEffect} from "react";
import type {Location} from "@/lib/types";
import {categoryIcon} from "@/lib/business-categories";
type Pin=Location&{businesses?:{name:string;category:string|null;slug:string}};
function Recenter({center}:{center:[number,number]}){const map=useMap();useEffect(()=>{map.setView(center,Math.max(map.getZoom(),11))},[center,map]);return null}
function pinIcon(category?:string|null){
 // El contenido HTML procede exclusivamente del catálogo interno de iconos.
 const emoji=categoryIcon(category);
 return divIcon({className:"loyally-map-marker",html:'<span aria-hidden="true">'+emoji+'</span>',iconSize:[40,40],iconAnchor:[20,40],popupAnchor:[0,-40]});
}
export default function DirectoryMap({locations,center}:{locations:Pin[];center:[number,number]}){
 return <MapContainer center={center} zoom={11} scrollWheelZoom={false} style={{height:"100%",width:"100%",borderRadius:18}}>
  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
  <Recenter center={center}/>
  {locations.map(x=><Marker key={x.id} position={[x.lat,x.lng]} icon={pinIcon(x.businesses?.category)}>
   <Popup><strong>{x.businesses?.name||x.name}</strong><div>{x.businesses?.category}</div><div>{x.address}, {x.city}</div><a href={"/unirse/"+encodeURIComponent(x.businesses?.slug||"")}>Ver programa</a></Popup>
  </Marker>)}
 </MapContainer>;
}
