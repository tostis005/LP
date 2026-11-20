import {KREYV_FILLED_PATHS,type KreyvIconName} from "@/lib/kreyv-icon-paths";
/** Icono vectorial de la galería aprobada. Un único color heredado o personalizado. */
export function KreyvIcon({name,size=24,color,className=""}:{name:KreyvIconName;size?:number;color?:string;className?:string}){
 return <svg className={"kreyv-icon "+className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size} fill="currentColor" style={color?{color}:undefined} aria-hidden="true" focusable="false">
  <path d={KREYV_FILLED_PATHS[name]} fillRule="evenodd"/>
 </svg>;
}
