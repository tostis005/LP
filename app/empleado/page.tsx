"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useSearchParams} from "next/navigation";
import {Suspense} from "react";
import {BrowserQRCodeReader,type IScannerControls} from "@zxing/browser";
import {Check,Gift,Keyboard,Minus,Plus,ScanLine,X,WifiOff,LoaderCircle} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {emptyMilestones,type MilestoneDetails} from "@/lib/milestones";
import {db} from "@/lib/supabase";
import {queueAward,submitAward,awards,syncAwards,removeAward} from "@/lib/client/offline";
import {dateShort,normalizeToken,units,customerDisplayName} from "@/lib/format";
import {displayCurrency} from "@/lib/currency";
type RewardChoice={id:string;label:string;retail_cents:number|null};
type StaffNote={rule_id:string;name:string;target:number;expires_at:string;instruction:string;redeemed:boolean};
type Found={membership_id:string;business_id:string;business_name:string;customer_name:string;program_type:"stamps"|"points"|"cashback";balance:number;reward_label:string;reward_cost:number;voucher_id?:string;max_stamps_per_action?:number;require_purchase_amount?:boolean;joined_at?:string;visits?:number;earned_total?:number;staff_notes?:StaffNote[]};
function StaffMain({account}:{account:Account}){
 const params=useSearchParams(),[input,setInput]=useState(""),[card,setCard]=useState<Found|null>(null),[receipt,setReceipt]=useState(""),[stamps,setStamps]=useState(1),[amount,setAmount]=useState(""),[cash,setCash]=useState(""),[busy,setBusy]=useState(false),[scanner,setScanner]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const [rewards,setRewards]=useState<RewardChoice[]>([]),[chosen,setChosen]=useState(""),[currency,setCurrency]=useState("MXN");
 const [milestones,setMilestones]=useState<MilestoneDetails>(emptyMilestones);
 const [queue,setQueue]=useState(()=>awards(account.user.id));
 const [looking,setLooking]=useState(false),[confirmed,setConfirmed]=useState(false);
 const lookupVersion=useRef(0),activeToken=useRef(""),operationBusy=useRef(false),confirmationTimer=useRef<ReturnType<typeof setTimeout>|null>(null),lastLink=useRef("");
 const scanButton=useRef<HTMLButtonElement>(null),clientHeading=useRef<HTMLHeadingElement>(null);
 const businessNames=account.businesses.filter(b=>b.role==="employee").map(b=>b.businesses?.name).filter(Boolean);
 useEffect(()=>()=>{lookupVersion.current++;if(confirmationTimer.current)clearTimeout(confirmationTimer.current);},[]);
 useEffect(()=>{if(card){window.scrollTo({top:0,behavior:"instant"});clientHeading.current?.focus({preventScroll:true});}},[card?.membership_id]);
 function clearLink(){
  const url=new URL(window.location.href);
  if(url.searchParams.has("code")||url.searchParams.has("reward")){url.searchParams.delete("code");url.searchParams.delete("reward");window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);}
 }
 function resetCard(){
  lookupVersion.current++;activeToken.current="";setLooking(false);setScanner(false);setCard(null);setInput("");setReceipt("");setAmount("");setCash("");setChosen("");setRewards([]);setMilestones(emptyMilestones);setStamps(1);setError("");clearLink();
 }
 function closeClient(){if(operationBusy.current||confirmed)return;resetCard();setSuccess("");window.scrollTo({top:0,behavior:"instant"});requestAnimationFrame(()=>scanButton.current?.focus({preventScroll:true}));}
 function complete(message:string){
  resetCard();setConfirmed(true);setSuccess(message);window.scrollTo({top:0,behavior:"instant"});
  if(confirmationTimer.current)clearTimeout(confirmationTimer.current);
  confirmationTimer.current=setTimeout(()=>{setConfirmed(false);setSuccess("");requestAnimationFrame(()=>scanButton.current?.focus({preventScroll:true}));},1400);
 }
 useEffect(()=>{const refresh=()=>{void syncAwards(account.user.id).finally(()=>setQueue(awards(account.user.id)))};refresh();window.addEventListener("online",refresh);return()=>window.removeEventListener("online",refresh)},[account.user.id]);
 const video=useRef<HTMLVideoElement>(null),controls=useRef<IScannerControls|null>(null);
 const lookup=useCallback(async(raw:string)=>{const voucherUrl=raw.match(/\/p\/([a-f0-9-]{36})/i);
  const version=++lookupVersion.current;
  const token=voucherUrl?.[1]||normalizeToken(raw);setError("");setSuccess("");setMilestones(emptyMilestones);setCard(null);activeToken.current="";setScanner(false);
  if(!token){setError("El código QR o identificador no es válido.");return}
  setInput(token);setLooking(true);
  if(!navigator.onLine&&!voucherUrl){try{sessionStorage.setItem("kreyvi-offline-scan",raw)}catch{}window.location.assign("/offline");return}
  let {data,error}=voucherUrl?await db().rpc("staff_lookup_voucher",{p_token:token}):await db().rpc("staff_lookup_card",{p_token:token});
  if(!voucherUrl&&!error&&(!data||!data.length)){const voucher=await db().rpc("staff_lookup_voucher",{p_token:token});if(!voucher.error&&voucher.data?.length){data=voucher.data;error=null;}}
  if(version!==lookupVersion.current)return;
  if(error){setLooking(false);if(!voucherUrl&&error.message==="No se pudo conectar con el servidor."){try{sessionStorage.setItem("kreyvi-offline-scan",raw)}catch{}window.location.assign("/offline");return}setError(error.message);setCard(null)}else if(!data?.length){setLooking(false);setError("Tarjeta no encontrada o sin permiso para este negocio.");setCard(null)}else {
   const found=data[0] as Found;
   const [limit,choices,business,context,ms]=await Promise.all([
    db().from("loyalty_programs").select("max_stamps_per_action,require_purchase_amount").eq("business_id",found.business_id).maybeSingle(),
    db().rpc("available_rewards",{p_business:found.business_id}),
    db().from("businesses").select("currency").eq("id",found.business_id).maybeSingle(),
    db().rpc("staff_card_context",{p_membership:found.membership_id}),db().rpc("stamp_milestone_details",{p_membership:found.membership_id})
   ]);
   if(version!==lookupVersion.current)return;
   setLooking(false);activeToken.current=token;
   setMilestones(ms.data||emptyMilestones);
   setCurrency(displayCurrency(business.data?.currency));
   setRewards((choices.data||[]) as RewardChoice[]);setChosen("");if(choices.error)setError(choices.error.message);
   const ctx=(context.data||[])[0] as {customer_label:string;joined_at:string;verified_visits:number;earned_total:number;staff_notes:StaffNote[]}|undefined;
   setAmount("");setReceipt("");setCash("");
   setCard({...found,require_purchase_amount:found.program_type!=="stamps"||!!limit.data?.require_purchase_amount,customer_name:ctx?.customer_label||found.customer_name,max_stamps_per_action:Number(limit.data?.max_stamps_per_action)||100,
    joined_at:ctx?.joined_at,visits:Number(ctx?.verified_visits||0),earned_total:Number(ctx?.earned_total||0),staff_notes:ctx?.staff_notes||[]});
   setStamps(1);
  }
 },[]);
 useEffect(()=>{const reward=params.get("reward"),code=params.get("code"),key=reward?"reward:"+reward:code?"code:"+code:"";if(!key){lastLink.current="";return;}if(key===lastLink.current)return;lastLink.current=key;if(reward)void lookup("/p/"+reward);else if(code)void lookup(code);},[lookup,params]);
 function startCamera(){if(looking||busy||confirmed)return;setError("");setSuccess("");setScanner(true)}
 function stopCamera(){setScanner(false)}
 useEffect(()=>{
  if(!scanner||!video.current)return;
  let cancelled=false,accepted=false;
  const reader=new BrowserQRCodeReader();
  reader.decodeFromVideoDevice(undefined,video.current,result=>{
   if(result&&!cancelled&&!accepted){accepted=true;controls.current?.stop();const value=result.getText();setScanner(false);void lookup(value)}
  }).then(c=>{if(cancelled||accepted)c.stop();else controls.current=c}).catch(()=>{
   if(!cancelled){setScanner(false);setError("No se ha podido abrir la cámara. Revisa los permisos del navegador o introduce el código manualmente.")}
  });
  return()=>{cancelled=true;controls.current?.stop();controls.current=null}
 },[scanner,lookup]);
 async function transact(kind:"earn"|"redeem"){if(!card||operationBusy.current||!activeToken.current)return;
  const token=activeToken.current;
  if(kind==="earn"&&card.require_purchase_amount&&(!Number.isFinite(Number(amount))||Number(amount)<=0)){setError("Introduce el importe de la compra.");return}
  operationBusy.current=true;setBusy(true);setError("");setSuccess("");
  try{
  let result;
  if(kind==="earn"&&!card.voucher_id){
   try{const a=queueAward({actor:account.user.id,business:card.business_id,token,amount:card.require_purchase_amount?Math.round(Number(amount)*100):0,stamps,ticket:receipt.trim()||null});const r=await submitAward(a);
    setQueue(awards(account.user.id));
    if(r.state==="pending"){resetCard();setSuccess("Compra guardada. Pendiente de sincronización.");return}if(r.state==="rejected"){setError(r.message||"Compra rechazada");return}
    result={data:r.balance,error:null};
   }catch(e){setBusy(false);setError((e as Error).message);return}
  }
  else {if(!window.confirm("¿Confirmas el canje de esta recompensa?")){setBusy(false);return}result=card.voucher_id?await db().rpc("staff_redeem_voucher_choice",{p_token:token,p_reward_option:chosen||null}):await db().rpc("staff_redeem_card_choice",{p_token:token,p_cashback_cents:card.program_type==="cashback"?Math.round(Number(cash)*100):null,p_reward_option:chosen||null})}
  if(result.error){setBusy(false);setError(result.error.message);return}
  complete(kind==="earn"?(card.program_type==="stamps"?"¡Sellos asignados!":card.program_type==="points"?"¡Puntos asignados!":"¡Cashback asignado!")+" Nuevo saldo: "+units(result.data,card.program_type,currency):"¡Recompensa canjeada correctamente!");
  }catch(e){setError((e as Error).message||"No se pudo registrar la operación.");}
  finally{operationBusy.current=false;setBusy(false);}
 }

 async function claimMilestone(id:string){
  if(!card||!navigator.onLine||operationBusy.current||!confirm("¿Confirmas que has entregado este premio intermedio? No descuenta sellos."))return;
  operationBusy.current=true;setBusy(true);setError("");setSuccess("");try{const r=await db().rpc("staff_claim_stamp_milestone",{p_grant:id});if(r.error){setError(r.error.message);return}setSuccess("Premio intermedio canjeado. Saldo de sellos sin cambios.");const ms=await db().rpc("stamp_milestone_details",{p_membership:card.membership_id});if(!ms.error)setMilestones(ms.data||emptyMilestones)}finally{operationBusy.current=false;setBusy(false)}
 }
 async function claimBonus(note:StaffNote){
  if(!card||operationBusy.current||note.redeemed||(card.earned_total||0)<note.target)return;
  if(!window.confirm("¿Confirmas que has entregado este regalo especial al cliente? Esta acción solo puede hacerse una vez."))return;
  operationBusy.current=true;setBusy(true);setError("");setSuccess("");
  try{
   const result=await db().rpc("staff_claim_automation_bonus",{p_rule:note.rule_id,p_membership:card.membership_id});
   if(result.error){setError(result.error.message);return}
   setCard(current=>current?{...current,staff_notes:(current.staff_notes||[]).map(n=>n.rule_id===note.rule_id?{...n,redeemed:true}:n)}:current);
   setSuccess("Regalo especial registrado. No se podrá entregar dos veces.");
  }finally{operationBusy.current=false;setBusy(false)}
 }
 return <div className="staff-app staff-fast-flow">
  {confirmed?<section className="staff-confirmation" role="status" aria-live="polite"><div className="staff-confirmation-icon"><Check size={48}/></div><h2>¡Todo listo!</h2><p>{success}</p><small>Volviendo al escáner…</small><button type="button" className="button button-outline" onClick={()=>{if(confirmationTimer.current)clearTimeout(confirmationTimer.current);setConfirmed(false);setSuccess("");}}>Escanear otra tarjeta</button></section>:card?
  <section className="panel-card staff-action-panel staff-client-screen" aria-label="Gestionar tarjeta del cliente">
   <div className="staff-client-top"><h2 ref={clientHeading} tabIndex={-1}>Tarjeta del cliente</h2><button type="button" className="staff-close" aria-label="Cerrar tarjeta" disabled={busy} onClick={closeClient}><X size={24}/></button></div>
   {error&&<div className="alert error" role="alert">{error}</div>}
   {success&&<div className="alert success" role="status"><Check size={18}/>{success}</div>}
   <div className="staff-customer-summary">
    <div className="staff-customer-header"><span>CLIENTE</span><strong>{customerDisplayName(card.customer_name)}</strong><small>{card.business_name}</small></div>
    <div className="staff-customer-stats">
     <div><small>Saldo actual</small><strong>{units(card.balance,card.program_type,currency)}</strong></div>
     <div><small>Fecha de alta</small><strong>{card.joined_at?dateShort(card.joined_at):"—"}</strong></div>
     <div><small>Visitas registradas</small><strong>{card.visits??"—"}</strong></div>
    </div>
   </div>
   {milestones.grants.some(g=>g.available)&&<div className="staff-campaign-notes"><strong><Gift size={18}/> Premios intermedios disponibles</strong>{milestones.grants.filter(g=>g.available).map(g=><div className="staff-campaign-note" key={g.id}><b>{g.label}</b><p>No descuenta sellos.</p><button className="staff-bonus-claim" disabled={busy} onClick={()=>void claimMilestone(g.id)}>Confirmar entrega</button></div>)}</div>}
   {(card.staff_notes||[]).length>0&&<div className="staff-campaign-notes" aria-label="Reglas de campañas automáticas">
    <strong><Gift size={18}/> Promociones activas para esta tarjeta</strong>
    {card.staff_notes!.map(note=>{
     const reached=(card.earned_total||0)>=note.target;
     const willReach=!reached&&card.program_type==="stamps"&&(card.earned_total||0)+stamps>=note.target;
     return <div key={note.name+"-"+note.target} className={"staff-campaign-note"+(willReach?" due":"")}>
      <b>{note.name}</b><p>{note.instruction}</p>
      <small>{note.redeemed?"Regalo ya entregado":reached?"Objetivo alcanzado; pendiente de validar entrega":willReach?"Se alcanza con esta compra":"Objetivo: "+units(note.target,card.program_type,currency)} · Límite {dateShort(note.expires_at)}</small>
      {(reached||note.redeemed)&&<button type="button" className="staff-bonus-claim" disabled={busy||note.redeemed}
       onClick={()=>void claimBonus(note)}><Check size={16}/>{note.redeemed?"Regalo entregado":"Confirmar entrega del regalo"}</button>}
     </div>;
    })}
   </div>}
  <div className="form-stack">{!card.voucher_id&&<>{card.program_type==="stamps"?<div className="staff-touch-stamps"><label>¿Cuántos sellos asignamos?</label><div className="staff-touch-stepper"><button type="button" aria-label="Restar sello" disabled={stamps<=1} onClick={()=>setStamps(n=>Math.max(1,n-1))}><Minus size={20}/></button><input aria-label="Número de sellos" min={1} max={card.max_stamps_per_action||100} type="number" value={stamps} onChange={e=>setStamps(Math.max(1,Math.min(card.max_stamps_per_action||100,Number(e.target.value)||1)))}/><button type="button" aria-label="Sumar sello" disabled={stamps>=(card.max_stamps_per_action||100)} onClick={()=>setStamps(n=>Math.min(card.max_stamps_per_action||100,n+1))}><Plus size={20}/></button></div><small>Máximo de {card.max_stamps_per_action||100} sellos por operación, según el programa.</small></div>:<label>Importe de la compra ({currency})<input type="number" value={amount} min="0.01" step="0.01" onChange={e=>setAmount(e.target.value)} placeholder="12,50"/></label>}
  {card.program_type==="stamps"&&card.require_purchase_amount&&<label>Importe de la compra ({currency})<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Ej. 85.00"/><small>Obligatorio para registrar la compra.</small></label>}
  <label>Referencia del ticket (recomendado)<input value={receipt} onChange={e=>setReceipt(e.target.value)} placeholder="Ej. T-2026-0015"/><small>Evita asignar dos veces puntos al mismo ticket si se registra la referencia.</small></label>
  <button className="button button-dark button-full" disabled={busy||!!card.voucher_id||(card.require_purchase_amount&&(!Number.isFinite(Number(amount))||Number(amount)<=0))||(card.program_type==="stamps"&&!(stamps>=1&&stamps<=(card.max_stamps_per_action||100)))} onClick={()=>transact("earn")}><Plus size={17}/> {busy?"Guardando...":card.program_type==="stamps"?"Asignar "+stamps+(stamps===1?" sello":" sellos"):card.program_type==="points"?"Asignar puntos":"Asignar cashback"}</button></>}
  {(card.voucher_id||card.program_type==="cashback"||card.balance>=card.reward_cost)&&<div className="redeem-box staff-reward-focus"><h3>{card.voucher_id?"Canjear premio con QR de un solo uso":"Canjear recompensa"}</h3><p>{card.reward_label}</p>
  {rewards.length>0&&<div><strong>Selecciona la promoción o producto que se entrega</strong><div className="reward-choice-grid">{rewards.map(o=><button type="button" key={o.id} onClick={()=>setChosen(o.id)} className={"reward-choice"+(chosen===o.id?" selected":"")} aria-pressed={chosen===o.id}><strong>{o.label}</strong></button>)}</div></div>}
  {card.program_type==="cashback"&&!card.voucher_id&&<label>Saldo a utilizar ({currency})<input type="number" min=".01" step=".01" value={cash} onChange={e=>setCash(e.target.value)} placeholder="5.00"/></label>}
  <button disabled={busy||(rewards.length>0&&!chosen)||(card.program_type!=="cashback"&&card.balance<card.reward_cost)} onClick={()=>transact("redeem")} className="button button-dark button-full"><Gift size={18}/> Canjear recompensa</button></div>}
  </div></section>:
  <section className="staff-scan-home" aria-label="Escanear tarjeta">
   <div className="staff-scan-heading"><h2>Escanear tarjeta</h2><p>{businessNames.length===1?businessNames[0]:"Acerca el QR del cliente"}</p></div>
   {error&&<div className="alert error" role="alert">{error}</div>}
   {success&&<div className="alert success" role="status">{success}</div>}
   {looking?<div className="staff-scan-target staff-scan-loading" role="status"><LoaderCircle size={48}/><strong>Buscando tarjeta…</strong><button type="button" className="staff-close" onClick={closeClient} aria-label="Cancelar búsqueda"><X size={23}/></button></div>:scanner?<div className="camera-frame staff-live-camera"><video ref={video} autoPlay muted playsInline/><div className="staff-camera-guide" aria-hidden="true"/><button type="button" className="staff-close" aria-label="Cerrar cámara" onClick={stopCamera}><X size={24}/></button><span>Coloca el QR dentro del recuadro</span></div>:<button ref={scanButton} type="button" className="staff-scan-target" onClick={startCamera}><span className="staff-scan-icon"><ScanLine size={86} strokeWidth={1.5}/></span><strong>Escanear</strong><small>Toca para abrir la cámara</small></button>}
   {!scanner&&!looking&&<><details className="staff-manual-entry"><summary><Keyboard size={19}/> Introducir código manualmente</summary><form onSubmit={e=>{e.preventDefault();void lookup(input)}} className="form-stack"><label>Enlace o identificador de tarjeta<input value={input} onChange={e=>setInput(e.target.value)} placeholder="Pega el enlace o UUID"/></label><button className="button button-outline button-full" disabled={!input.trim()} type="submit">Buscar tarjeta</button></form></details>
   <a href="/offline" className="staff-offline-link"><WifiOff size={17}/> Modo sin conexión{queue.length?" · "+queue.length+" pendientes":""}</a>
   {queue.length>0&&<details className="staff-pending-queue"><summary>Compras pendientes ({queue.length})</summary>{queue.map(a=><p key={a.id}>{a.ticket||new Date(a.at).toLocaleString()} · {a.error||"Pendiente"} {a.error&&<button type="button" onClick={()=>{if(confirm("¿Descartar la compra rechazada?")){removeAward(a);setQueue(awards(account.user.id))}}}>Descartar</button>}</p>)}<button type="button" className="button button-outline" onClick={()=>void syncAwards(account.user.id).finally(()=>setQueue(awards(account.user.id)))}>Sincronizar</button></details>}</>}
  </section>}
 </div>;
}
function StaffPanel(){return <AppFrame area="staff" title="Caja" subtitle="">{a=><StaffMain account={a}/>}</AppFrame>}
export default function StaffPage(){return <Suspense fallback={<div className="loading-screen">Abriendo escáner...</div>}><StaffPanel/></Suspense>}
