import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { Brand } from "@/components/Brand";
export function PublicHeader() {
  return <header className="public-header"><div className="container header-inner">
    <Brand />
    <nav className="top-nav" aria-label="Navegación principal">
      <Link href="/#funcionalidades">Funcionalidades</Link>
      <Link href="/#como-funciona">Cómo funciona</Link>
      <Link href="/precios">Precios</Link>
    </nav>
    <div className="header-actions"><Link href="/acceder" className="nav-login">Iniciar sesión</Link>
      <Link href="/#contacto" className="button button-dark button-sm">Solicitar acceso <ArrowUpRight size={16}/></Link></div>
    <Link className="mobile-menu" href="/precios" aria-label="Ver planes"><Menu/></Link>
  </div></header>;
}
