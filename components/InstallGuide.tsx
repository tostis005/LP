"use client";
import {useEffect,useState} from "react";
import {QRCodeSVG} from "qrcode.react";
import {ArrowRight,CheckCircle2,Download,MoreVertical,Share2,Smartphone} from "lucide-react";
import Link from "next/link";
import type {LandingLanguage} from "@/lib/landing-copy";

type InstallPrompt=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
type Device="ios"|"android"|"desktop";
const copy={
 es:{
  eyebrow:"LOYALLY EN TU MÓVIL",title:"La app de Loyally,",accent:"siempre a mano.",
  intro:"Instálala directamente desde nuestra web, sin App Store, sin Google Play y sin coste. Tus tarjetas y recompensas estarán a un toque.",
  button:"Instalar Loyally gratis",open:"Abrir Loyally",installed:"Loyally ya está instalada en este dispositivo.",
  success:"Instalación aceptada. Encuentra Loyally entre tus aplicaciones.",
  instruction:"Elige tu móvil y sigue estos pasos:",ios:"En iPhone o iPad",android:"En Android",
  iphoneSteps:["Abre esta página en Safari.","Toca Compartir en la barra de Safari.","Selecciona «Añadir a pantalla de inicio» y confirma."],
  androidSteps:["Abre esta página en Chrome.","Pulsa el menú de tres puntos (⋮).","Elige «Instalar aplicación» o «Añadir a pantalla de inicio»."],
  fallbackIos:"Apple no permite iniciar esta instalación desde un botón web. Se hace desde el menú Compartir de Safari.",
  fallbackAndroid:"Si no aparece el diálogo de instalación, utiliza el menú de Chrome. No hace falta descargar un archivo APK.",
  desktop:"¿Estás en un ordenador?",scan:"Escanea el QR con tu móvil y abre esta misma web para instalar Loyally.",
  note:"Es una aplicación web instalable (PWA). No requiere descargar un archivo ni pagar a las tiendas."
 },
 en:{
  eyebrow:"LOYALLY ON YOUR PHONE",title:"Your Loyally app,",accent:"always one tap away.",
  intro:"Install it directly from our website, with no App Store, no Google Play, and no charge. Your loyalty cards and rewards are always within reach.",
  button:"Install Loyally for free",open:"Open Loyally",installed:"Loyally is already installed on this device.",
  success:"Installation accepted. Find Loyally among your apps.",
  instruction:"Choose your phone and follow these steps:",ios:"On iPhone or iPad",android:"On Android",
  iphoneSteps:["Open this page in Safari.","Tap Share in the Safari toolbar.","Select “Add to Home Screen” and confirm."],
  androidSteps:["Open this page in Chrome.","Tap the three-dot menu (⋮).","Choose “Install app” or “Add to Home screen”."],
  fallbackIos:"Apple does not allow web pages to start installation directly. Use Safari's Share menu instead.",
  fallbackAndroid:"If no installation prompt appears, use Chrome's menu. No APK download is needed.",
  desktop:"On a computer?",scan:"Scan this QR code with your phone to open this website and install Loyally.",
  note:"This is an installable web app (PWA). No files or app store fees are required."
 }
} as const;

export function InstallGuide({lang="es"}:{lang?:LandingLanguage}){
 const t=copy[lang];
 const [device,setDevice]=useState<Device>("desktop");
 const [installed,setInstalled]=useState(false);
 const [deferredPrompt,setDeferredPrompt]=useState<InstallPrompt|null>(null);
 const [notice,setNotice]=useState("");
 const [origin,setOrigin]=useState("");
 const [instructionsVisible,setInstructionsVisible]=useState(false);
 useEffect(()=>{
  setOrigin(window.location.origin);
  const standalone=window.matchMedia("(display-mode: standalone)").matches ||
   (navigator as Navigator & {standalone?:boolean}).standalone===true;
  setInstalled(standalone);
  const ua=navigator.userAgent;
  setDevice(/iPhone|iPad|iPod/.test(ua)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1
   ?"ios":/Android/i.test(ua)?"android":"desktop");
  function capture(e:Event){e.preventDefault();setDeferredPrompt(e as InstallPrompt);}
  function completed(){setInstalled(true);setDeferredPrompt(null);setNotice(t.success);}
  window.addEventListener("beforeinstallprompt",capture);
  window.addEventListener("appinstalled",completed);
  return()=>{window.removeEventListener("beforeinstallprompt",capture);window.removeEventListener("appinstalled",completed);};
 },[t.success]);
 async function install(){
  if(installed){window.location.assign("/app");return;}
  if(deferredPrompt){
   try{
    await deferredPrompt.prompt();
    const choice=await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if(choice.outcome==="accepted"){setNotice(t.success);return;}
   }catch{/* Browser may decline or not support the prompt. Show manual instructions. */}
  }
  setInstructionsVisible(true);
  setNotice(device==="ios"?t.fallbackIos:t.fallbackAndroid);
 }
 return <section className="loi-install-section" id="instalar" aria-labelledby="loi-install-heading">
  <div className="container loi-install-layout">
   <div className="loi-install-intro">
    <span className="loi-overline"><Smartphone size={16}/>{t.eyebrow}</span>
    <h2 id="loi-install-heading">{t.title}<br/><em>{t.accent}</em></h2>
    <p>{t.intro}</p>
    {installed?
     <Link href="/app" className="loi-button loi-button-main"><CheckCircle2 size={20}/>{t.open}<ArrowRight size={18}/></Link>:
     <button type="button" onClick={install} className="loi-button loi-button-main loi-install-primary"><Download size={19}/>{t.button}<ArrowRight size={18}/></button>}
    {installed&&<p className="loi-install-confirmation"><CheckCircle2 size={16}/>{t.installed}</p>}
    {notice&&!installed&&<p className="loi-install-confirmation" role="status">{notice}</p>}
    <p className="loi-install-note">{t.note}</p>
   </div>
   <div className="loi-install-card">
    <div className="loi-install-card-header"><span className="loi-install-phone-icon"><Smartphone size={24}/></span><strong>{t.instruction}</strong></div>
    <div className="loi-install-steps">
     <div className={"loi-install-platform"+(device==="ios"?" is-current":"")}>
      <div className="loi-install-platform-name"><strong>{t.ios}</strong>{device==="ios"&&<CheckCircle2 size={17}/>}</div>
      <ol>{t.iphoneSteps.map((step,i)=><li key={step}><span>{i+1}</span><p>{step}{i===1&&<Share2 size={14} aria-hidden="true"/>}</p></li>)}</ol>
     </div>
     <div className={"loi-install-platform"+(device==="android"?" is-current":"")}>
      <div className="loi-install-platform-name"><strong>{t.android}</strong>{device==="android"&&<CheckCircle2 size={17}/>}</div>
      <ol>{t.androidSteps.map((step,i)=><li key={step}><span>{i+1}</span><p>{step}{i===1&&<MoreVertical size={14} aria-hidden="true"/>}</p></li>)}</ol>
     </div>
    </div>
    {instructionsVisible&&<p className="loi-install-extra" role="status">{device==="ios"?t.fallbackIos:t.fallbackAndroid}</p>}
    <div className="loi-install-qr">
     <div><strong>{t.desktop}</strong><p>{t.scan}</p></div>
     {origin&&<div className="loi-qr-box" aria-label="QR para abrir Loyally en el móvil"><QRCodeSVG value={origin+"/"} size={84} marginSize={0} fgColor="#571c32" bgColor="#ffffff"/></div>}
    </div>
   </div>
  </div>
 </section>;
}
