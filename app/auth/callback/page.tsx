"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {db} from "@/lib/supabase";
export default function AuthCallback(){
 const router=useRouter(),[error,setError]=useState("");
 useEffect(()=>{db().auth.getUser().then(({data})=>{
  if(data?.user)router.replace("/entrar");
  else setError("Este enlace de autenticación ya no es válido. Solicita uno nuevo.");
 })},[router]);
 return <div className="loading-screen">{error||"Comprobando sesión..."}</div>;
}
