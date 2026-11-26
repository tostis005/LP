"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {QRCodeSVG} from "qrcode.react";
import {ArrowRight,Check,Smartphone} from "lucide-react";
import {KreyvIcon} from "@/components/KreyvIcon";
import {BrandText} from "@/components/BrandText";
import {StampCard} from "@/components/StampCard";
import type {LandingLanguage} from "@/lib/landing-copy";

type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
const textContent={
 es:{
  kicker:"LLEVA Kreyvi CONTIGO",head:"Tus tarjetas.",accent:"Tus próximos premios.",
  intro:"Todo lo que te gusta de tus lugares favoritos, siempre contigo. Guarda tus tarjetas, descubre tus recompensas y vuelve por más.",
  add:"Tener la app en mi móvil",open:"Entrar a mi espacio",ios:"Instalar en iPhone o iPad",iosHint:"En Safari, usa Compartir → Añadir a pantalla de inicio. Si aparece, activa Abrir como app web.",
  ready:"¡Listo! Busca el icono de Kreyvi en tu móvil y ábrelo.",
  badges:["Tus tarjetas","Tus sellos","Tus premios"],
  phoneLabel:"MI Kreyvi",card:"Cerca de tu próximo regalo",cardDetail:"5 de 8 visitas",
  qrTitle:"¿Lo estás viendo en un ordenador?",qrText:"Escanea para llevar Kreyvi a tu móvil.",
  helper:"La próxima vez, entra desde el icono de Kreyvi en tu pantalla de inicio."
 },
 en:{
  kicker:"KEEP Kreyvi CLOSE",head:"Your cards.",accent:"Your next rewards.",
  intro:"Everything you love about your favorite places, always with you. Save your cards, discover rewards, and come back for more.",
  add:"Add the app to my phone",open:"Open my account",ios:"Install on iPhone or iPad",iosHint:"In Safari, use Share → Add to Home Screen. Enable Open as Web App if shown.",
  ready:"All set! Find the Kreyvi icon on your phone and open it.",
  badges:["Your cards","Your stamps","Your rewards"],
  phoneLabel:"MY Kreyvi",card:"Your next reward is close",cardDetail:"5 of 8 visits",
  qrTitle:"Viewing on a computer?",qrText:"Scan to bring Kreyvi to your phone.",
  helper:"Next time, open Kreyvi from the icon on your home screen."
 }
} as const;

export function InstallGuide({lang="es"}:{lang?:LandingLanguage}){
 const t=textContent[lang];
 const [nativePrompt,setNativePrompt]=useState<InstallPrompt|null>(null);
 const [installed,setInstalled]=useState(false);
 const [ios,setIos]=useState(false);
 const [origin,setOrigin]=useState("");
 const [message,setMessage]=useState("");
 useEffect(()=>{
  setOrigin("https://kreyvi.com");
  setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1));
  setInstalled(window.matchMedia("(display-mode: standalone)").matches||
   (navigator as Navigator&{standalone?:boolean}).standalone===true);
  function onPrompt(event:Event){event.preventDefault();setNativePrompt(event as InstallPrompt);}
  function onInstalled(){setInstalled(true);setNativePrompt(null);}
  window.addEventListener("beforeinstallprompt",onPrompt);
  window.addEventListener("appinstalled",onInstalled);
  return()=>{window.removeEventListener("beforeinstallprompt",onPrompt);window.removeEventListener("appinstalled",onInstalled);};
 },[]);

 async function install(){
  if(installed){window.location.assign("/mi-loyally");return;}
  if(ios){window.location.assign("/mi-loyally?instalar=1");return;}
  if(nativePrompt){
   try{
    await nativePrompt.prompt();
    const choice=await nativePrompt.userChoice;
    setNativePrompt(null);
    if(choice.outcome==="accepted"){setMessage(t.ready);return;}
   }catch{ /* The customer can always use the on-screen phone instructions. */ }
  }
  window.location.assign("/mi-loyally?instalar=1");
 }
 return <section className="loi-install-section" id="instalar" aria-labelledby="loi-install-heading">
  <div className="container loi-install-layout">
   <div className="loi-install-intro">
    <span className="loi-overline"><KreyvIcon name="mis-tarjetas" size={16}/><BrandText value={t.kicker}/></span>
    <h2 id="loi-install-heading">{t.head}<br/><em>{t.accent}</em></h2>
    <p>{t.intro}</p>
    <div className="loi-install-benefits">{t.badges.map((name,i)=>{const icon=(["mis-tarjetas","sellos","premios"] as const)[i];return <span key={name}><KreyvIcon name={icon} size={16}/>{name}</span>;})}</div>
    <div className="loi-install-actions">
     <button type="button" onClick={install} className="loi-button loi-button-main loi-install-primary"><Smartphone size={19}/>{ios&&!installed?t.ios:t.add}<ArrowRight size={18}/></button>
     <Link href="/mi-loyally" className="loi-button loi-button-light">{t.open}</Link>
    </div>
    {message&&<p className="loi-install-confirmation" role="status"><Check size={16}/><BrandText value={message}/></p>}
    {ios&&!installed&&<p className="loi-install-note">{t.iosHint}</p>}
    <p className="loi-install-note"><BrandText value={t.helper}/></p>
   </div>
   <div className="loi-install-card loi-install-app-preview">
    <div className="loi-install-app-top"><span className="loi-install-app-icon"><img src="/kreyv-mark-v3.svg" alt=""/></span><strong><BrandText value="Kreyvi"/></strong><span className="loi-install-app-love"><KreyvIcon name="recompensa" size={24}/></span></div>
    <span className="loi-install-app-caption"><BrandText value={t.phoneLabel}/></span>
    <div className="loi-marketing-card loi-marketing-card-noma"><StampCard locale={lang} name="Café Noma" color="#183E5B" stampColor="#183E5B" reward={lang==="en"?"A coffee on us":"Un café gratis"} total={8} earned={5} icon="coffee" message={lang==="en"?"THANKS FOR COMING BACK":"GRACIAS POR VOLVER"}/></div>
    <div className="loi-install-app-nav"><span><KreyvIcon name="mis-tarjetas" size={17}/>{t.badges[0]}</span><span><KreyvIcon name="premios" size={17}/>{t.badges[2]}</span><span><KreyvIcon name="sellos" size={17}/>{t.badges[1]}</span></div>
    <div className="loi-install-qr">
     <div><strong>{t.qrTitle}</strong><p><BrandText value={t.qrText}/></p></div>
     {origin&&<div className="loi-qr-box" aria-label="Código para abrir Kreyvi en el móvil"><QRCodeSVG value={origin+"/mi-loyally?instalar=1"} size={84} marginSize={4} fgColor="#5E1A2B" bgColor="#ffffff"/></div>}
    </div>
   </div>
  </div>
 </section>;
}
