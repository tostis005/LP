"use client";
import {MapContainer,TileLayer,Marker,useMap,useMapEvents} from "react-leaflet";
import {divIcon} from "leaflet";
import {useEffect} from "react";

type Point={lat:number;lng:number};
const icon=divIcon({
 className:"lp-address-marker",iconSize:[32,43],iconAnchor:[16,42],
 html:'<div class="lp-address-marker-pin"><span></span></div>'
});
function Recenter({point}:{point:Point|null}){
 const map=useMap();
 useEffect(()=>{if(point)map.setView([point.lat,point.lng],Math.max(14,map.getZoom()))},[point?.lat,point?.lng,map]);
 return null;
}
function ClickToPosition({onChange}:{onChange:(point:Point)=>void}){
 useMapEvents({click(event){onChange({lat:event.latlng.lat,lng:event.latlng.lng})}});
 return null;
}
export default function AddressMap({point,onChange}:{point:Point|null;onChange:(point:Point)=>void}){
 return <div className="lp-address-map"><MapContainer center={point?[point.lat,point.lng]:[23.6345,-102.5528]} zoom={point?15:4} scrollWheelZoom={false} style={{height:"100%",width:"100%"}}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'/>
  <Recenter point={point}/>
  <ClickToPosition onChange={onChange}/>
  {point&&<Marker position={[point.lat,point.lng]} icon={icon} draggable eventHandlers={{dragend(e){const p=e.target.getLatLng();onChange({lat:p.lat,lng:p.lng})}}}/>}
 </MapContainer></div>;
}
