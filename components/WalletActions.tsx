"use client";
import {Wallet,Smartphone,Info} from "lucide-react";

type Flags={apple:boolean;google:boolean};
export function WalletActions({cardId,available,compact=false}:{cardId:string;available:Flags;compact?:boolean}){
 const providers=[
  {id:"apple" as const,label:"Añadir a Apple Wallet",hint:"iPhone y Apple Watch"},
  {id:"google" as const,label:"Añadir a Google Wallet",hint:"Android y dispositivos compatibles"}
 ];
 return <div className={"lp-wallet-choices"+(compact?" lp-wallet-choices-compact":"")} aria-label="Guardar tarjeta en una Wallet">
  {providers.map(p=>available[p.id]?
   <a key={p.id} className={"lp-wallet-choice lp-wallet-"+p.id} href={"/api/local/wallet/"+p.id+"?card="+encodeURIComponent(cardId)}>
    <Wallet size={19}/><span>{p.label}<small>{p.hint}</small></span>
   </a>:
   <div key={p.id} className="lp-wallet-choice lp-wallet-disabled" aria-label={p.label+" pendiente de activación"}>
    <Wallet size={19}/><span>{p.label}<small>Pendiente de activación</small></span>
   </div>)}
  {!available.apple&&!available.google&&<p className="lp-wallet-choices-note"><Info size={15}/> Loyally está preparando los pases oficiales. Mientras tanto, tu tarjeta y su QR funcionan desde la app y puedes guardar una copia en tu móvil.</p>}
 </div>;
}
