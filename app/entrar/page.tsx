"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {configured,db} from "@/lib/supabase";
export default function Enter(){const router=useRouter(),[error,setError]=useState("");
useEffect(()=>{async function route(){try{
 if(!configured()){setError("No se ha podido conectar con el servidor Loyally");return}
 const {data:{user}}=await db().auth.getUser();
 if(!user){router.replace("/acceder");return}
 await db().rpc("claim_invitations");
 const pendingJoin=window.localStorage.getItem("lp_pending_join");
 if(pendingJoin && /^[a-f0-9-]{36}$/i.test(pendingJoin)){
  const target=await db().from("businesses").select("slug").eq("id",pendingJoin).maybeSingle();
  window.localStorage.removeItem("lp_pending_join");
  if(!target.error&&typeof target.data?.slug==="string"){
   // Primero elige notificaciones y confirma la tarjeta; no autorizar en silencio.
   router.replace("/unirse/"+encodeURIComponent(target.data.slug));return;
  }
 }
 const [admins,members]=await Promise.all([db().from("platform_admins").select("user_id").eq("user_id",user.id).maybeSingle(),db().from("business_members").select("role").eq("user_id",user.id).eq("active",true)]);
 if(admins.data){router.replace("/admin");return}
 if(((members.data||[]) as {role:string}[]).some(x=>x.role==="owner"||x.role==="manager")){router.replace("/negocio");return}
 if(((members.data||[]) as {role:string}[]).some(x=>x.role==="employee")){router.replace("/empleado");return}
 router.replace("/app");
 }catch(e){setError((e as Error).message)}}route()},[router]);
return <div className="loading-screen">{error||"Preparando tu espacio..."}</div>}
