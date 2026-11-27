"use client";
import {useEffect,useState} from "react";

type Provider="google"|"apple";
type Availability=Record<Provider,boolean>;
export function SocialAuthButtons({next="/app",lang="es"}:{next?:string;lang?:"es"|"en"}){
 const [available,setAvailable]=useState<Availability>({google:false,apple:false});
 useEffect(()=>{
  let active=true;
  fetch("/api/local/oauth/providers",{cache:"no-store",credentials:"same-origin"})
   .then(r=>r.ok?r.json():Promise.reject())
   .then((data:Availability)=>{if(active)setAvailable({google:data.google===true,apple:data.apple===true});})
   .catch(()=>{});
  return()=>{active=false;};
 },[]);
 if(!available.google&&!available.apple)return null;
 return <div className="loyally-social-auth">
  <div className="loyally-social-divider"><span>{lang==="en"?"Or continue with":"O continúa con"}</span></div>
  <div className="loyally-social-list">
   {available.google&&<a className="loyally-social-button loyally-social-google"
    href={"/api/local/oauth/google/start?next="+encodeURIComponent(next)}>
    <span aria-hidden="true" className="loyally-social-google-mark">G</span>{lang==="en"?"Continue with Google":"Continuar con Google"}
   </a>}
   {available.apple&&<a className="loyally-social-button loyally-social-apple"
    href={"/api/local/oauth/apple/start?next="+encodeURIComponent(next)}>
    <span aria-hidden="true" className="loyally-social-apple-mark"></span>{lang==="en"?"Continue with Apple":"Continuar con Apple"}
   </a>}
  </div>
 </div>;
}
