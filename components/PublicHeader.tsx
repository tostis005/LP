import Link from "next/link";
import {ArrowUpRight} from "lucide-react";
import {Brand} from "@/components/Brand";
import {LANDING_COPY,type LandingLanguage} from "@/lib/landing-copy";
import {publicHref,publicLinks,type PublicPage} from "@/lib/public-navigation";
export function PublicHeader({lang="es",page="business"}:{lang?:LandingLanguage;page?:PublicPage}){
 const t=LANDING_COPY[lang].nav,en=lang==="en";
 const languageHref=(target:LandingLanguage)=>page==="help"?"/help?lang="+target:publicHref(page,target);
 return <header className="public-header loi-public-header shared-public-header"><div className="container header-inner">
  <Brand href={publicHref("customer",lang)}/>
  <nav className="top-nav shared-public-nav" aria-label={en?"Main navigation":"Navegación principal"}>
   {publicLinks(lang).map(item=><Link key={item.page} href={item.href} aria-current={page===item.page?"page":undefined}>{item.label}</Link>)}
  </nav>
  <div className="header-actions loi-header-actions"><nav className="loi-language-switch" aria-label={t.language}>
   <a href={languageHref("es")} lang="es" aria-current={lang==="es"?"page":undefined} className={lang==="es"?"selected":""} title="Ver en español">ES</a><span aria-hidden="true">/</span><a href={languageHref("en")} lang="en" aria-current={lang==="en"?"page":undefined} className={lang==="en"?"selected":""} title="View in English">EN</a></nav>
   <Link href="/acceder" className="button button-dark button-sm">{t.login} <ArrowUpRight size={16}/></Link>
  </div>
 </div></header>;
}
