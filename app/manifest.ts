import type {MetadataRoute} from "next";
export default function manifest(): MetadataRoute.Manifest {
 return {
  id:"/app",name:"Loyally",short_name:"Loyally",
  description:"Tus tarjetas, sellos y premios de tus negocios favoritos",
  start_url:"/mi-loyally",scope:"/",display:"standalone",
  background_color:"#fbf7f8",theme_color:"#571c32",
  categories:["shopping","lifestyle"],
  icons:[
   {src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"},
   {src:"/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
   {src:"/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"}
  ]
 };
}
