"use client";
import {useEffect,useState} from "react";
import {Download,Share2,X} from "lucide-react";
type InstallEvent=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export function InstallLoyally(){
 const [prompt,setPrompt]=useState<InstallEvent|null>(null);
 const [ios,setIos]=useState(false),[installed,setInstalled]=useState(false),[showHelp,setShowHelp]=useState(false);
 useEffect(()=>{
  const standalone=window.matchMedia("(display-mode: standalone)").matches ||
   (navigator as Navigator & {standalone?:boolean}).standalone===true;
  setInstalled(standalone);
  setIos(/iPhone|iPad|iPod/.test(navigator.userAgent));
  function capture(event:Event){event.preventDefault();setPrompt(event as InstallEvent)}
  function complete(){setInstalled(true);setPrompt(null);setShowHelp(false)}
  window.addEventListener("beforeinstallprompt",capture);
  window.addEventListener("appinstalled",complete);
  return()=>{window.removeEventListener("beforeinstallprompt",capture);window.removeEventListener("appinstalled",complete)};
 },[]);
 if(installed||(!prompt&&!ios))return null;
 async function install(){
  if(!prompt){setShowHelp(true);return}
  await prompt.prompt();
  const response=await prompt.userChoice;
  if(response.outcome==="accepted")setPrompt(null);
 }
 return <div className="lp-install-widget">
  <button type="button" className="lp-install-button" onClick={install}><Download size={17}/> Instalar Kreyv</button>
  {showHelp&&<div className="lp-install-help" role="dialog" aria-label="Instalar Kreyv">
   <button type="button" onClick={()=>setShowHelp(false)} className="lp-install-close" aria-label="Cerrar"><X size={17}/></button>
   <strong>Añade Kreyv a tu iPhone</strong>
   <p>Abre esta página en Safari, toca <Share2 size={15} aria-hidden="true"/> Compartir y elige «Añadir a pantalla de inicio».</p>
   <small>Gratis y sin App Store. Se actualizará desde nuestra web.</small>
  </div>}
 </div>;
}
