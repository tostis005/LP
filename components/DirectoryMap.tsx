"use client";
import {MapContainer,TileLayer,CircleMarker,Popup,useMap} from "react-leaflet";
import {useEffect} from "react";
import type {Location} from "@/lib/types";
type Pin=Location&{businesses?:{name:string;category:string|null;slug:string}};
function Recenter({center}:{center:[number,number]}){const map=useMap();useEffect(()=>{map.setView(center,Math.max(map.getZoom(),10))},[center,map]);return null}
export default function DirectoryMap({locations,center}:{locations:Pin[];center:[number,number]}){
return <MapContainer center={center} zoom={10} scrollWheelZoom={false} style={{height:"100%",width:"100%",borderRadius:18}}>
<TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
<Recenter center={center}/>
{locations.map(x=><CircleMarker key={x.id} center={[x.lat,x.lng]} radius={11} pathOptions={{color:"#fff",weight:3,fillColor:"#264d3e",fillOpacity:1}}><Popup><strong>{x.businesses?.name||x.name}</strong><div>{x.address}, {x.city}</div></Popup></CircleMarker>)}
</MapContainer>
}
