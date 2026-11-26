import Link from "next/link";
import {ArrowUpRight} from "lucide-react";
import {Brand} from "@/components/Brand";
import {LANDING_COPY,landingHref,type LandingLanguage} from "@/lib/landing-copy";

export function PublicHeader({lang="es"}:{lang?:LandingLanguage}){
 const t=LANDING_COPY[lang].nav;
 return <header className="public-header loi-public-header"><div className="container header-inner">
  <Brand href={landingHref(lang)}/>
  <nav className="top-nav" aria-label={lang==="en"?"Main navigation":"Navegación principal"}>
   <Link href="/">{lang==="en"?"For customers":"Para clientes"}</Link>
   <Link href={landingHref(lang,"beneficios")}>{t.benefits}</Link>
   <Link href={landingHref(lang,"como-funciona")}>{t.how}</Link>
   <Link href={landingHref(lang,"personalizacion")}>{t.design}</Link>
   <a href="/mi-loyally?instalar=1" className="loi-nav-install">{lang==="en"?"The app":"La app"}</a>
  </nav>
  <div className="header-actions loi-header-actions">
   <nav className="loi-language-switch" aria-label={t.language}>
    <Link href={landingHref("es")} lang="es" aria-current={lang==="es"?"page":undefined} className={lang==="es"?"selected":""} title="Ver en español">ES</Link>
    <span aria-hidden="true">/</span>
    <Link href={landingHref("en")} lang="en" aria-current={lang==="en"?"page":undefined} className={lang==="en"?"selected":""} title="View in English">EN</Link>
   </nav>
   <Link href="/solicitar-acceso" className="nav-login">{t.info}</Link>
   <Link href="/acceder" className="button button-dark button-sm">{t.login} <ArrowUpRight size={16}/></Link>
  </div>
 </div></header>;
}
