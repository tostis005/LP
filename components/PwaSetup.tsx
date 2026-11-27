"use client";
import {useEffect} from "react";
export function PwaSetup(){
 useEffect(()=>{
  if(!("serviceWorker" in navigator)||!(location.protocol==="https:"||location.hostname==="localhost"))return;
  let live=true;
  let registration:ServiceWorkerRegistration|undefined;
  const update=()=>{if(live&&document.visibilityState==="visible")void registration?.update().catch(()=>{});};
  navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).then(reg=>{registration=reg;update()}).catch(()=>{});
  window.addEventListener("online",update);
  document.addEventListener("visibilitychange",update);
  return()=>{live=false;window.removeEventListener("online",update);document.removeEventListener("visibilitychange",update)};
 },[]);
 return null;
}
