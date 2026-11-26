"use client";
import {useEffect} from "react";
import {KreyviLoading} from "@/components/KreyviLoading";
// The manifest launches /entrar. This isolated fallback only handles older
// home-screen icons saved at /. It never wraps or controls the public HTML.
export function InstalledAppEntry(){
 useEffect(()=>{
  const browser=window.matchMedia("(display-mode: browser)").matches;
  const standalone=window.matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
  if(!browser&&standalone&&location.pathname==="/")window.location.replace("/entrar");
 },[]);
 return <div className="installed-root-loading" aria-hidden="true"><KreyviLoading label="Abriendo Kreyvi"/></div>;
}
