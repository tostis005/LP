import type {LandingLanguage} from "./landing-copy";
export type PublicPage="customer"|"business"|"help"|"app"|"contact"|"pricing";
export function publicHref(page:PublicPage,lang:LandingLanguage){
 const paths:Record<PublicPage,string>={customer:"/",business:"/para-negocios",help:"/contacto",app:"/mi-loyally",contact:"/contacto",pricing:"/precios"};
 return paths[page]+(page==="app"?"?instalar=1"+(lang==="en"?"&lang=en":""):lang==="en"?"?lang=en":"");
}
export function publicLinks(lang:LandingLanguage){
 const en=lang==="en";
 return [{page:"customer",label:en?"For customers":"Para clientes"},{page:"business",label:en?"For businesses":"Para negocios"},{page:"app",label:en?"The app":"La app"},{page:"contact",label:en?"Contact":"Contacto"}].map(item=>({...item,page:item.page as PublicPage,href:publicHref(item.page as PublicPage,lang)}));
}

/** Commercial CTAs keep their intent while opening the single public form. */
export function publicBusinessContactHref(lang:LandingLanguage){return "/contacto?topic=business_access"+(lang==="en"?"&lang=en":"")+"#contact";}
