"use client";
import {useEffect} from "react";
import type {LandingLanguage} from "@/lib/landing-copy";

// El contenido se renderiza en servidor; se sincroniza también la etiqueta
// de idioma del documento para lectores de pantalla y navegadores.
export function LandingLanguageSync({lang}:{lang:LandingLanguage}){
 useEffect(()=>{
  document.documentElement.lang=lang;
  return ()=>{document.documentElement.lang="es"};
 },[lang]);
 return null;
}
