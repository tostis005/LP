import {KREYV_FILLED_PATHS,KREYV_ICON_BOXES,type KreyvIconName} from "@/lib/kreyv-icon-paths";
/** Pictograma sólido y monocolor, normalizado a la misma retícula óptica. */
export function KreyvIcon({name,size=24,color,className=""}:{name:KreyvIconName;size?:number;color?:string;className?:string}){
 return <svg className={"kreyv-icon "+className} xmlns="http://www.w3.org/2000/svg" viewBox={KREYV_ICON_BOXES[name]} width={size} height={size} fill="currentColor" style={color?{color}:undefined} aria-hidden="true" focusable="false">
  <path d={KREYV_FILLED_PATHS[name]} fillRule="evenodd"/>
 </svg>;
}
