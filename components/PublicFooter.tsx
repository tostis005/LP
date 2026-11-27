import Link from "next/link";
import {Brand} from "@/components/Brand";
import {publicLinks,publicHref,type PublicPage} from "@/lib/public-navigation";
import type {LandingLanguage} from "@/lib/landing-copy";
export function PublicFooter({lang="es",page}:{lang?:LandingLanguage;page?:PublicPage}){
 const en=lang==="en";
 return <footer className="shared-public-footer"><div className="container shared-public-footer-inner"><div><Brand href={publicHref("customer",lang)}/><p>{en?"Small moments. More reasons to return.":"Pequeños momentos. Más motivos para volver."}</p></div><nav aria-label={en?"Footer links":"Enlaces del pie de página"}>{publicLinks(lang).map(item=><Link key={item.page} href={item.href} aria-current={page===item.page?"page":undefined}>{item.label}</Link>)}</nav></div><div className="container shared-public-footer-bottom">© {new Date().getFullYear()} Kreyvi</div></footer>;
}
