import Link from "next/link";
export function Brand({light=false}:{light?:boolean}){
 return <Link href="/" className={"brand"+(light?" brand-light":"")} aria-label="Loyally, ir al inicio">
  <span className="brand-symbol">L<span>.</span></span>
  <span className="brand-name">Loyal<span>ly</span></span>
 </Link>;
}
