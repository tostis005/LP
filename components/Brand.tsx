import Link from "next/link";
export function Brand({light=false,href="/"}:{light?:boolean;href?:string}){
 return <Link href={href} className={"brand"+(light?" brand-light":"")} aria-label="Loyally, ir al inicio">
  <span className="brand-symbol" aria-hidden="true">L</span>
  <span className="brand-name">Loyal<span>ly</span></span>
 </Link>;
}
