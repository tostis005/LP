import {LandingHome} from "@/components/LandingHome";
import "../landing.css";
export const dynamic="force-dynamic";
export default async function BusinessLanding({searchParams}:{searchParams:Promise<{lang?:string}>}){
 const {lang}=await searchParams;
 return <LandingHome lang={lang==="en"?"en":"es"}/>;
}
