"use client";
import {useEffect,useState} from "react";
import {QRCodeSVG} from "qrcode.react";
import {Brand} from "@/components/Brand";
import {MerchantCard} from "@/components/StampCard";
import {KreyviLoading} from "@/components/KreyviLoading";
import {offlineAccount,offlineCards,clearOfflineAccount,type OfflineAccount,type Snapshot} from "@/lib/client/offline";
import {db} from "@/lib/supabase";

export function CachedCustomerSpace({embedded=false,recover=false}:{embedded?:boolean;recover?:boolean}){
 const [ready,setReady]=useState(false),[account,setAccount]=useState<OfflineAccount|null>(null),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[selected,setSelected]=useState(""),[signingOut,setSigningOut]=useState(false);
 useEffect(()=>{const a=offlineAccount();setAccount(a?.area==="customer"?a:null);setSnapshot(offlineCards());setReady(true);},[]);
 useEffect(()=>{
  if(!recover||!account||signingOut)return;
  let live=true,running=false;
  const retry=async()=>{
   if(!live||running||!navigator.onLine||document.visibilityState==="hidden")return;
   running=true;
   try{
    const auth=await db().auth.getUser();if(!live||auth.error)return;
    if(auth.data?.user?.id!==account.id){clearOfflineAccount();setAccount(null);setSnapshot(null);window.location.replace("/entrar");return;}
    // Verify the actual document is reachable before leaving the cached view.
    const doc=await fetch("/app",{cache:"no-store",credentials:"same-origin"});
    if(live&&doc.ok&&doc.headers.get("Content-Type")?.includes("text/html"))window.location.replace("/app");
   }catch{}finally{running=false}
  };
  void retry();window.addEventListener("online",retry);window.addEventListener("focus",retry);
  const timer=window.setInterval(retry,15000);
  return()=>{live=false;window.removeEventListener("online",retry);window.removeEventListener("focus",retry);window.clearInterval(timer)};
 },[recover,account,signingOut]);
 const card=snapshot?.cards.find(c=>c.id===selected);
 const content=<div className="customer-first-layout customer-cached-space">
  {!ready?<KreyviLoading compact label="Preparando tus tarjetas"/>:<>
   <div className="customer-home-greeting"><span className="customer-overline">TUS RECOMPENSAS</span><h2>Hola{account?.name?", "+account.name.trim().split(/\s+/)[0]:""}<span className="customer-greeting-dot">.</span></h2><p>{snapshot?.cards.length||0} {(snapshot?.cards.length||0)===1?"tarjeta":"tarjetas"}</p></div>
   <div className="customer-list-heading"><h2>Mis tarjetas</h2></div>
   {card?<section className="cached-card-list"><button type="button" className="button button-outline cached-card-back" onClick={()=>setSelected("")}>Volver a mis tarjetas</button><MerchantCard business={card.businesses} program={snapshot?.programs.find(p=>p.business_id===card.business_id)} balance={card.balance} milestones={snapshot?.milestones?.[card.id]?.rules}/><div className="cached-card-qr"><h3>Mi QR</h3><QRCodeSVG value={"https://kreyviapp.com/t/"+card.card_token} size={280} marginSize={4} level="M"/><p>Enseña este QR en el establecimiento.</p></div></section>:snapshot?.cards.length?<div className="cached-card-list">{snapshot.cards.map(c=><button key={c.id} type="button" className="cached-card-button" onClick={()=>setSelected(c.id)} aria-label={"Abrir tarjeta de "+c.businesses.name}><MerchantCard business={c.businesses} program={snapshot.programs.find(p=>p.business_id===c.business_id)} balance={c.balance} milestones={snapshot.milestones?.[c.id]?.rules}/></button>)}</div>:<div className="empty-state"><h3>{snapshot?"Aún no tienes tarjetas":"Tus tarjetas"}</h3><p>{snapshot?"Aquí encontrarás tus tarjetas.":"Tus tarjetas aparecerán cuando estén disponibles."}</p></div>}
   {account&&<div className="cached-space-footer"><button type="button" className="button button-outline button-sm" disabled={signingOut} onClick={async()=>{if(!confirm("¿Cerrar sesión en este dispositivo?"))return;setSigningOut(true);const result=await db().auth.signOut();if(!result.error){setAccount(null);setSnapshot(null);setSelected("");window.location.replace("/acceder");}else{setSigningOut(false);}}}>{signingOut?"Cerrando sesión…":"Cerrar sesión"}</button></div>}
  </>}
 </div>;
 return embedded?content:<div className="workspace workspace-customer"><div className="workspace-main"><div className="customer-native-header"><Brand href="/app"/></div><main className="workspace-content">{content}</main></div></div>;
}
