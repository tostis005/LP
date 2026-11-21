"use client";
import {Wallet,Info} from "lucide-react";

type Provider="apple"|"google";
type Flags={apple:boolean;google:boolean};

export function WalletActions({cardId,available,compact=false,onUnavailable}:{
 cardId:string;available:Flags;compact?:boolean;onUnavailable:(provider:Provider)=>void
}){
 const providers=[
  {id:"apple" as const,label:"Añadir a Apple Wallet",hint:"iPhone y Apple Watch"},
  {id:"google" as const,label:"Añadir a Google Wallet",hint:"Android y dispositivos compatibles"}
 ];
 return <div className={"lp-wallet-choices"+(compact?" lp-wallet-choices-compact":"")} aria-label="Guardar tarjeta en una Wallet">
  {providers.map(p=>available[p.id]?
   <a key={p.id} className={"lp-wallet-choice lp-wallet-"+p.id} href={"/api/local/wallet/"+p.id+"?card="+encodeURIComponent(cardId)}>
    <Wallet size={19}/><span>{p.label}<small>{p.hint}</small></span>
   </a>:
   <button key={p.id} type="button" className="lp-wallet-choice lp-wallet-disabled lp-wallet-help"
    onClick={()=>onUnavailable(p.id)} aria-label={p.label+": ver alternativa disponible"}>
    <Wallet size={19}/><span>{p.label}<small>No disponible · Ver alternativa</small></span>
   </button>)}
  {!available.apple&&!available.google&&!compact&&<p className="lp-wallet-choices-note"><Info size={15}/> Los pases oficiales todavía no están habilitados. Puedes guardar una imagen con el QR de tu tarjeta.</p>}
 </div>;
}
