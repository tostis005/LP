import Link from "next/link";
export function Brand({light=false}:{light?:boolean}){
 return <Link href="/" className={"brand"+(light?" brand-light":"")} aria-label="LoiaG, ir al inicio">
  <span className="brand-symbol">L<span>.</span></span>
  <span className="brand-name">Loia<span>G</span></span>
 </Link>;
}
