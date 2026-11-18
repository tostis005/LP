import type {MetadataRoute} from "next";
export default function manifest(): MetadataRoute.Manifest {
 return {name:"Loyally",short_name:"Loyally",description:"Tus tarjetas de fidelización y negocios favoritos",start_url:"/app",display:"standalone",background_color:"#f8f7f2",theme_color:"#264d3e",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml"}]};
}
