import type {Metadata} from "next";
import {LandingHome} from "@/components/LandingHome";
import "../landing.css";
import {LandingLanguageSync} from "@/components/LandingLanguageSync";
import type {LandingLanguage} from "@/lib/landing-copy";

// La raíz se reescribe internamente a esta ruta, preservando ?lang=en.
export const dynamic="force-dynamic";
type Props={searchParams:Promise<{lang?:string|string[]}>};
async function language(searchParams:Props["searchParams"]):Promise<LandingLanguage>{
 const {lang}=await searchParams;
 return lang==="en"?"en":"es";
}
export async function generateMetadata({searchParams}:Props):Promise<Metadata>{
 const lang=await language(searchParams);
 return lang==="en"?{
  title:"Kreyv — Give customers a reason to come back",
  description:"Turn every visit into lasting customer relationships. Loyalty experiences and thoughtful rewards for local businesses.",
 }:{
  title:"Kreyv — Haz que tus clientes vuelvan",
  description:"Convierte cada visita en una relación duradera. Fidelización y recompensas cercanas para negocios locales.",
 };
}
export default async function Presentation({searchParams}:Props){
 const lang=await language(searchParams);
 return <><LandingLanguageSync lang={lang}/><LandingHome lang={lang}/></>;
}
