import Link from "next/link";
import {BRAND_NAME} from "@/lib/brand";
/** Marca global. Mantener logos de cada negocio fuera de este componente. */
export function Brand({light=false,href="/"}:{light?:boolean;href?:string}){
 return <Link href={href} className={"brand"+(light?" brand-light":"")} aria-label={BRAND_NAME+", ir al inicio"}>
  <img className="brand-logo-image brand-logo-vino-light" src="/brand/kreyv-pegada-vino-mostaza-claro.svg" alt=""/>
  <img className="brand-logo-image brand-logo-vino-dark" src="/brand/kreyv-pegada-vino-mostaza-oscuro.svg" alt=""/>
  <img className="brand-logo-image brand-logo-ink-light" src="/brand/kreyv-pegada-tinta-maiz-claro.svg" alt=""/>
  <img className="brand-logo-image brand-logo-ink-dark" src="/brand/kreyv-pegada-tinta-maiz-oscuro.svg" alt=""/>
  <span className="brand-sr-only">{BRAND_NAME}</span>
 </Link>;
}
