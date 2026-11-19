"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {QRCodeSVG} from "qrcode.react";
import {ArrowRight,Check,Gift,Heart,Smartphone,Ticket} from "lucide-react";
import type {LandingLanguage} from "@/lib/landing-copy";

type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
const textContent={
 es:{
  kicker:"LLEVA LOYALLY CONTIGO",head:"Tus tarjetas.",accent:"Tus próximos premios.",
  intro:"Todo lo que te gusta de tus lugares favoritos, siempre contigo. Guarda tus tarjetas, descubre tus recompensas y vuelve por más.",
  add:"Tener Loyally en mi móvil",open:"Entrar a mis tarjetas",
  ready:"¡Listo! Busca el icono de Loyally en tu móvil y ábrelo.",
  badges:["Tus tarjetas","Tus sellos","Tus premios"],
  phoneLabel:"MI LOYALLY",card:"Cerca de tu próximo regalo",cardDetail:"5 de 8 visitas",
  qrTitle:"¿Lo estás viendo en un ordenador?",qrText:"Escanea para llevar Loyally a tu móvil.",
  helper:"La próxima vez, entra desde el icono de Loyally en tu pantalla de inicio."
 },
 en:{
  kicker:"KEEP LOYALLY CLOSE",head:"Your cards.",accent:"Your next rewards.",
  intro:"Everything you love about your favorite places, always with you. Save your cards, discover rewards, and come back for more.",
  add:"Add Loyally to my phone",open:"See my cards",
  ready:"All set! Find the Loyally icon on your phone and open it.",
  badges:["Your cards","Your stamps","Your rewards"],
  phoneLabel:"MY LOYALLY",card:"Your next reward is close",cardDetail:"5 of 8 visits",
  qrTitle:"Viewing on a computer?",qrText:"Scan to bring Loyally to your phone.",
  helper:"Next time, open Loyally from the icon on your home screen."
 }
} as const;

export function InstallGuide({lang="es"}:{lang?:LandingLanguage}){
 const t=textContent[lang];
 const [nativePrompt,setNativePrompt]=useState<InstallPrompt|null>(null);
 const [installed,setInstalled]=useState(false);
 const [origin,setOrigin]=useState("");
 const [message,setMessage]=useState("");
 useEffect(()=>{
  setOrigin(window.location.origin);
  setInstalled(window.matchMedia("(display-mode: standalone)").matches||
   (navigator as Navigator&{standalone?:boolean}).standalone===true);
  function onPrompt(event:Event){event.preventDefault();setNativePrompt(event as InstallPrompt);}
  function onInstalled(){setInstalled(true);setNativePrompt(null);}
  window.addEventListener("beforeinstallprompt",onPrompt);
  window.addEventListener("appinstalled",onInstalled);
  return()=>{window.removeEventListener("beforeinstallprompt",onPrompt);window.removeEventListener("appinstalled",onInstalled);};
 },[]);

 async function install(){
  if(installed){window.location.assign("/app");return;}
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
    <span className="loi-overline"><Heart size={16}/>{t.kicker}</span>
    <h2 id="loi-install-heading">{t.head}<br/><em>{t.accent}</em></h2>
    <p>{t.intro}</p>
    <div className="loi-install-benefits">{t.badges.map((name,i)=>{const Icon=[Ticket,Heart,Gift][i];return <span key={name}><Icon size={16}/>{name}</span>;})}</div>
    <div className="loi-install-actions">
     <button type="button" onClick={install} className="loi-button loi-button-main loi-install-primary"><Smartphone size={19}/>{t.add}<ArrowRight size={18}/></button>
     <Link href="/mi-loyally" className="loi-button loi-button-light">{t.open}</Link>
    </div>
    {message&&<p className="loi-install-confirmation" role="status"><Check size={16}/>{message}</p>}
    <p className="loi-install-note">{t.helper}</p>
   </div>
   <div className="loi-install-card loi-install-app-preview">
    <div className="loi-install-app-top"><span className="loi-install-app-icon">L</span><strong>Loyally</strong><span className="loi-install-app-love">♡</span></div>
    <span className="loi-install-app-caption">{t.phoneLabel}</span>
    <div className="loi-install-app-reward">
     <div className="loi-install-app-reward-head"><strong>Café Noma</strong><Gift size={22}/></div>
     <p>{t.card}</p>
     <div className="loi-install-app-stamps">{Array.from({length:8},(_,i)=><span className={i<5?"filled":""} key={i}><Heart size={15}/></span>)}</div>
     <small>{t.cardDetail}</small>
    </div>
    <div className="loi-install-app-nav"><span><Ticket size={17}/>{t.badges[0]}</span><span><Gift size={17}/>{t.badges[2]}</span><span><Heart size={17}/>{t.badges[1]}</span></div>
    <div className="loi-install-qr">
     <div><strong>{t.qrTitle}</strong><p>{t.qrText}</p></div>
     {origin&&<div className="loi-qr-box" aria-label="Código para abrir Loyally en el móvil"><QRCodeSVG value={origin+"/mi-loyally?instalar=1"} size={84} fgColor="#571c32" bgColor="#ffffff"/></div>}
    </div>
   </div>
  </div>
 </section>;
}
