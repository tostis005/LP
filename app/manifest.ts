import type {MetadataRoute} from "next";
import {BRAND_NAME,BRAND_THEME} from "@/lib/brand";
export default function manifest(): MetadataRoute.Manifest {
 return {
  id:"/app",name:BRAND_NAME,short_name:BRAND_NAME,
  description:"Tus tarjetas, sellos y premios de tus negocios favoritos",
  start_url:"/mi-loyally",scope:"/",display:"standalone",
  background_color:BRAND_THEME==="tinta-maiz"?"#F7F2E8":"#F5EFE6",
  theme_color:BRAND_THEME==="tinta-maiz"?"#1D2340":"#5E1A2B",
  categories:["shopping","lifestyle"],
  icons:[
   {src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"},
   {src:"/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
   {src:"/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"}
  ]
 };
}
