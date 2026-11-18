"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {db,configured} from "@/lib/supabase";
export default function AuthCallback(){const router=useRouter(),[error,setError]=useState("");
 useEffect(()=>{async function finish(){try{
 if(!configured())throw new Error("Supabase no configurado");
 const code=new URL(window.location.href).searchParams.get("code");
 if(code){const {error}=await db().auth.exchangeCodeForSession(code);if(error){const session=await db().auth.getSession();if(!session.data.session)throw error}}
 const {data}=await db().auth.getUser();if(!data.user)throw new Error("No se ha podido iniciar sesión");
 router.replace("/entrar");
 }catch(e){setError((e as Error).message)}}finish()},[router]);
 return <div className="loading-screen">{error||"Verificando tu acceso..."}</div>}
