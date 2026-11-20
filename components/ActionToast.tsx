"use client";
import {useEffect,useState} from "react";
import {CheckCircle2,AlertCircle,X} from "lucide-react";
import {actionToastEvent,type ToastTone} from "@/lib/action-toast";

type Notice={id:number;message:string;tone:ToastTone};
export function ActionToast(){
 const [notice,setNotice]=useState<Notice|null>(null);
 useEffect(()=>{
  let nextId=0;
  function onNotice(event:Event){
   const payload=(event as CustomEvent<{message?:string;tone?:ToastTone}>).detail;
   if(!payload||typeof payload.message!=="string"||!payload.message.trim())return;
   setNotice({id:++nextId,message:payload.message,tone:payload.tone==="error"?"error":"success"});
  }
  window.addEventListener(actionToastEvent,onNotice);
  return()=>window.removeEventListener(actionToastEvent,onNotice);
 },[]);
 useEffect(()=>{
  if(!notice)return;
  const timer=window.setTimeout(()=>setNotice(prev=>prev?.id===notice.id?null:prev),4400);
  return()=>window.clearTimeout(timer);
 },[notice]);
 if(!notice)return null;
 return <div className={"loyally-action-toast "+notice.tone} role={notice.tone==="error"?"alert":"status"} aria-live={notice.tone==="error"?"assertive":"polite"}>
  {notice.tone==="success"?<CheckCircle2 size={20}/>:<AlertCircle size={20}/>}
  <span>{notice.message}</span>
  <button type="button" aria-label="Cerrar aviso" onClick={()=>setNotice(null)}><X size={17}/></button>
 </div>;
}
