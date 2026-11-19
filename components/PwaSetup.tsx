"use client";
import {useEffect} from "react";
export function PwaSetup(){
 useEffect(()=>{
  if("serviceWorker" in navigator && (location.protocol==="https:" || location.hostname==="localhost")){
   navigator.serviceWorker.register("/sw.js").catch(()=>{});
  }
 },[]);
 return null;
}
