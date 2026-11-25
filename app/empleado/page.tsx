"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useSearchParams} from "next/navigation";
import {Suspense} from "react";
import {BrowserQRCodeReader,type IScannerControls} from "@zxing/browser";
import {Camera,Check,Gift,Keyboard,Minus,Plus,RefreshCw,ScanLine,ShieldCheck,StopCircle,Ticket} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {db} from "@/lib/supabase";
import {dateShort,normalizeToken,units,customerDisplayName} from "@/lib/format";
import {displayCurrency} from "@/lib/currency";
type RewardChoice={id:string;label:string;retail_cents:number|null};
type StaffNote={rule_id:string;name:string;target:number;expires_at:string;instruction:string;redeemed:boolean};
type Found={membership_id:string;business_id:string;business_name:string;customer_name:string;program_type:"stamps"|"points"|"cashback";balance:number;reward_label:string;reward_cost:number;voucher_id?:string;max_stamps_per_action?:number;require_purchase_amount?:boolean;joined_at?:string;visits?:number;earned_total?:number;staff_notes?:StaffNote[]};
function StaffMain({account}:{account:Account}){
 const params=useSearchParams(),[input,setInput]=useState(""),[card,setCard]=useState<Found|null>(null),[receipt,setReceipt]=useState(""),[stamps,setStamps]=useState(1),[amount,setAmount]=useState(""),[cash,setCash]=useState(""),[busy,setBusy]=useState(false),[scanner,setScanner]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const [rewards,setRewards]=useState<RewardChoice[]>([]),[chosen,setChosen]=useState(""),[currency,setCurrency]=useState("MXN");
 const video=useRef<HTMLVideoElement>(null),controls=useRef<IScannerControls|null>(null);
 const lookup=useCallback(async(raw:string)=>{const voucherUrl=raw.match(/\/p\/([a-f0-9-]{36})/i);
  const token=voucherUrl?.[1]||normalizeToken(raw);setError("");setSuccess("");
  if(!token){setError("El código QR o identificador no es válido.");return}
  setInput(token);
  let {data,error}=voucherUrl?await db().rpc("staff_lookup_voucher",{p_token:token}):await db().rpc("staff_lookup_card",{p_token:token});
  if(!voucherUrl&&!error&&(!data||!data.length)){const voucher=await db().rpc("staff_lookup_voucher",{p_token:token});if(!voucher.error&&voucher.data?.length){data=voucher.data;error=null;}}
  if(error){setError(error.message);setCard(null)}else if(!data?.length){setError("Tarjeta no encontrada o sin permiso para este negocio.");setCard(null)}else {
   const found=data[0] as Found;
   const [limit,choices,business,context]=await Promise.all([
    db().from("loyalty_programs").select("max_stamps_per_action,require_purchase_amount").eq("business_id",found.business_id).maybeSingle(),
    db().rpc("available_rewards",{p_business:found.business_id}),
    db().from("businesses").select("currency").eq("id",found.business_id).maybeSingle(),
    db().rpc("staff_card_context",{p_membership:found.membership_id})
   ]);
   setCurrency(displayCurrency(business.data?.currency));
   setRewards((choices.data||[]) as RewardChoice[]);setChosen("");if(choices.error)setError(choices.error.message);
   const ctx=(context.data||[])[0] as {customer_label:string;joined_at:string;verified_visits:number;earned_total:number;staff_notes:StaffNote[]}|undefined;
   setAmount("");setReceipt("");setCash("");
   setCard({...found,require_purchase_amount:found.program_type!=="stamps"||!!limit.data?.require_purchase_amount,customer_name:ctx?.customer_label||found.customer_name,max_stamps_per_action:Number(limit.data?.max_stamps_per_action)||100,
    joined_at:ctx?.joined_at,visits:Number(ctx?.verified_visits||0),earned_total:Number(ctx?.earned_total||0),staff_notes:ctx?.staff_notes||[]});
   setStamps(1);
  }
 },[]);
 useEffect(()=>{const reward=params.get("reward"),code=params.get("code");if(reward)lookup("/p/"+reward);else if(code)lookup(code);},[lookup,params]);
 function startCamera(){setError("");setScanner(true)}
 function stopCamera(){setScanner(false)}
 useEffect(()=>{
  if(!scanner||!video.current)return;
  let cancelled=false;
  const reader=new BrowserQRCodeReader();
  reader.decodeFromVideoDevice(undefined,video.current,result=>{
   if(result&&!cancelled){const value=result.getText();setScanner(false);lookup(value)}
  }).then(c=>{if(cancelled)c.stop();else controls.current=c}).catch(()=>{
   if(!cancelled){setScanner(false);setError("No se ha podido abrir la cámara. Revisa los permisos del navegador o introduce el código manualmente.")}
  });
  return()=>{cancelled=true;controls.current?.stop();controls.current=null}
 },[scanner,lookup]);
 async function transact(kind:"earn"|"redeem"){if(!card)return;
  if(kind==="earn"&&card.require_purchase_amount&&(!Number.isFinite(Number(amount))||Number(amount)<=0)){setError("Introduce el importe de la compra.");return}
  setBusy(true);setError("");setSuccess("");
  let result;
  if(kind==="earn"&&!card.voucher_id){result=await db().rpc("staff_award_card",{p_token:input,p_purchase_cents:card.require_purchase_amount?Math.round(Number(amount)*100):0,p_stamps:stamps,p_ticket_ref:receipt.trim()||null});}
  else {if(!window.confirm("¿Confirmas el canje de esta recompensa?")){setBusy(false);return}result=card.voucher_id?await db().rpc("staff_redeem_voucher_choice",{p_token:input,p_reward_option:chosen||null}):await db().rpc("staff_redeem_card_choice",{p_token:input,p_cashback_cents:card.program_type==="cashback"?Math.round(Number(cash)*100):null,p_reward_option:chosen||null})}
  setBusy(false);if(result.error){setError(result.error.message);return}
  setSuccess(kind==="earn"?"Compra registrada. Nuevo saldo: "+units(result.data,card.program_type,currency):"Recompensa canjeada. Saldo restante: "+units(result.data,card.program_type,currency));
  setCard(kind==="redeem"?null:{...card,balance:result.data,earned_total:(card.earned_total||0)+(kind==="earn"&&card.program_type==="stamps"?stamps:0),visits:(card.visits||0)+(kind==="earn"?1:0)});setReceipt("");setAmount("");setCash("");setChosen("")
 }
 async function claimBonus(note:StaffNote){
  if(!card||note.redeemed||(card.earned_total||0)<note.target)return;
  if(!window.confirm("¿Confirmas que has entregado este regalo especial al cliente? Esta acción solo puede hacerse una vez."))return;
  setBusy(true);setError("");setSuccess("");
  try{
   const result=await db().rpc("staff_claim_automation_bonus",{p_rule:note.rule_id,p_membership:card.membership_id});
   if(result.error){setError(result.error.message);return}
   setCard(current=>current?{...current,staff_notes:(current.staff_notes||[]).map(n=>n.rule_id===note.rule_id?{...n,redeemed:true}:n)}:current);
   setSuccess("Regalo especial registrado. No se podrá entregar dos veces.");
  }finally{setBusy(false)}
 }
 return <div className="staff-app">
  <div className="staff-app-intro"><span className="page-eyebrow">CAJA Y FIDELIZACIÓN</span><h2>Escanea, registra y listo.</h2><p>El QR identifica al cliente. Comprueba la operación antes de sumar sellos o canjear un premio.</p></div>
  <div className="scanner-grid"><section className="panel-card staff-scan-panel"><div className="panel-icon"><ScanLine size={23}/></div><h2>Escanear tarjeta</h2>
  {scanner?<div className="camera-frame"><video ref={video} autoPlay muted playsInline/><button className="button button-outline button-sm" onClick={stopCamera}><StopCircle size={16}/> Detener</button></div>:<div className="scanner-placeholder"><ScanLine size={54}/><span>Listo para escanear</span><small>Presenta el QR de la tarjeta del cliente.</small></div>}
  {!scanner&&<button className="button button-dark button-full" onClick={startCamera}><Camera size={18}/> Abrir cámara</button>}
  <details className="staff-manual-entry"><summary><Keyboard size={17}/> Introducir código manualmente</summary>
   <form onSubmit={e=>{e.preventDefault();void lookup(input)}} className="form-stack">
    <label>Enlace o identificador de tarjeta<input value={input} onChange={e=>setInput(e.target.value)} placeholder="Pega el enlace o UUID"/></label>
    <button className="button button-outline button-full"><Keyboard size={18}/> Buscar tarjeta</button>
   </form>
  </details>
 </section>
 <section className="panel-card staff-action-panel"><div className="panel-icon peach"><Ticket size={22}/></div>
  <h2>{card?"Tarjeta encontrada":"Registrar compra"}</h2>
  {error&&<div className="alert error" role="alert">{error}</div>}
  {success&&<div className="alert success" role="status"><Check size={18}/>{success}</div>}
  {!card?<div className="scan-await"><ScanLine size={35}/><strong>Esperando una tarjeta</strong><p>Al escanear verás el nombre abreviado, los sellos y las acciones disponibles.</p></div>:<>
   <div className="staff-customer-summary">
    <div className="staff-customer-header"><span>CLIENTE</span><strong>{customerDisplayName(card.customer_name)}</strong><small>{card.business_name}</small></div>
    <div className="staff-customer-stats">
     <div><small>Saldo actual</small><strong>{units(card.balance,card.program_type,currency)}</strong></div>
     <div><small>Fecha de alta</small><strong>{card.joined_at?dateShort(card.joined_at):"—"}</strong></div>
     <div><small>Visitas registradas</small><strong>{card.visits??"—"}</strong></div>
    </div>
   </div>
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
  <div className="form-stack">{card.program_type==="stamps"?<div className="staff-touch-stamps"><label>¿Cuántos sellos asignamos?</label><div className="staff-touch-stepper"><button type="button" aria-label="Restar sello" disabled={stamps<=1} onClick={()=>setStamps(n=>Math.max(1,n-1))}><Minus size={20}/></button><input aria-label="Número de sellos" min={1} max={card.max_stamps_per_action||100} type="number" value={stamps} onChange={e=>setStamps(Math.max(1,Math.min(card.max_stamps_per_action||100,Number(e.target.value)||1)))}/><button type="button" aria-label="Sumar sello" disabled={stamps>=(card.max_stamps_per_action||100)} onClick={()=>setStamps(n=>Math.min(card.max_stamps_per_action||100,n+1))}><Plus size={20}/></button></div><small>Máximo de {card.max_stamps_per_action||100} sellos por operación, según el programa.</small></div>:<label>Importe de la compra ({currency})<input type="number" value={amount} min="0.01" step="0.01" onChange={e=>setAmount(e.target.value)} placeholder="12,50"/></label>}
  {card.program_type==="stamps"&&card.require_purchase_amount&&<label>Importe de la compra ({currency})<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Ej. 85.00"/><small>Obligatorio para registrar la compra.</small></label>}
  <label>Referencia del ticket (recomendado)<input value={receipt} onChange={e=>setReceipt(e.target.value)} placeholder="Ej. T-2026-0015"/><small>Evita asignar dos veces puntos al mismo ticket si se registra la referencia.</small></label>
  <button className="button button-dark button-full" disabled={busy||!!card.voucher_id||(card.require_purchase_amount&&(!Number.isFinite(Number(amount))||Number(amount)<=0))||(card.program_type==="stamps"&&!(stamps>=1&&stamps<=(card.max_stamps_per_action||100)))} onClick={()=>transact("earn")}><Plus size={17}/> {busy?"Guardando...":"Registrar compra / sellos"}</button>
  <div className="redeem-box staff-reward-focus"><h3>{card.voucher_id?"Canjear premio con QR de un solo uso":"Canjear recompensa"}</h3><p>{card.reward_label}</p>
  {rewards.length>0&&<div><strong>Selecciona la promoción o producto que se entrega</strong><div className="reward-choice-grid">{rewards.map(o=><button type="button" key={o.id} onClick={()=>setChosen(o.id)} className={"reward-choice"+(chosen===o.id?" selected":"")} aria-pressed={chosen===o.id}><strong>{o.label}</strong></button>)}</div></div>}
  {card.program_type==="cashback"&&!card.voucher_id&&<label>Saldo a utilizar ({currency})<input type="number" min=".01" step=".01" value={cash} onChange={e=>setCash(e.target.value)} placeholder="5.00"/></label>}
  <button disabled={busy||(rewards.length>0&&!chosen)||(card.program_type!=="cashback"&&card.balance<card.reward_cost)} onClick={()=>transact("redeem")} className="button button-dark button-full"><Gift size={18}/> Canjear recompensa</button></div>
  </div></>}
 </section></div></div>;
}
function StaffPanel(){return <AppFrame area="staff" title="Caja" subtitle="">{a=><StaffMain account={a}/>}</AppFrame>}
export default function StaffPage(){return <Suspense fallback={<div className="loading-screen">Abriendo escáner...</div>}><StaffPanel/></Suspense>}
