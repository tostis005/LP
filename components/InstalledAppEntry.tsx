"use client";
import {useEffect,useLayoutEffect,useState,type ReactNode} from "react";
import {useRouter} from "next/navigation";
import {KreyviLoading} from "@/components/KreyviLoading";
// Browser visitors always see the public landing, even with an existing session.
// Only an installed standalone window enters the private session router.
export function InstalledAppEntry({children}:{children:ReactNode}){
 const router=useRouter(),[installed,setInstalled]=useState(false);
 useLayoutEffect(()=>{
  const standalone=window.matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
  if(standalone){setInstalled(true);router.replace("/entrar");}
 },[router]);
 return installed?<KreyviLoading label="Preparando tu espacio"/>:<>{children}</>;
}
