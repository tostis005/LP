import Link from "next/link";
import {ArrowUpRight} from "lucide-react";
import {Brand} from "@/components/Brand";

export function PublicHeader(){
 return <header className="public-header loi-public-header"><div className="container header-inner">
  <Brand/>
  <nav className="top-nav" aria-label="Navegación principal">
   <Link href="/#funcionalidades">Funcionalidades</Link>
   <Link href="/#como-funciona">Cómo funciona</Link>
   <Link href="/#para-quien">Para quién</Link>
  </nav>
  <div className="header-actions"><Link href="/solicitar-acceso" className="nav-login">Solicitar información</Link><Link href="/acceder" className="button button-dark button-sm">Acceder <ArrowUpRight size={16}/></Link></div>
 </div></header>;
}
