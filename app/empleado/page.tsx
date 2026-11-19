"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useSearchParams} from "next/navigation";
import {Suspense} from "react";
import {BrowserQRCodeReader,type IScannerControls} from "@zxing/browser";
import {Camera,Check,Gift,Keyboard,Minus,Plus,RefreshCw,ScanLine,ShieldCheck,StopCircle,Ticket} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {db} from "@/lib/supabase";
import {normalizeToken,units} from "@/lib/format";
type RewardChoice={id:string;label:string;retail_cents:number};
type Found={membership_id:string;business_id:string;business_name:string;customer_name:string;program_type:"stamps"|"points"|"cashback";balance:number;reward_label:string;reward_cost:number;voucher_id?:string;max_stamps_per_action?:number};
function StaffMain({account}:{account:Account}){
 const params=useSearchParams(),[input,setInput]=useState(""),[card,setCard]=useState<Found|null>(null),[receipt,setReceipt]=useState(""),[stamps,setStamps]=useState(1),[amount,setAmount]=useState(""),[cash,setCash]=useState(""),[busy,setBusy]=useState(false),[scanner,setScanner]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const [rewards,setRewards]=useState<RewardChoice[]>([]),[chosen,setChosen]=useState("");
 const video=useRef<HTMLVideoElement>(null),controls=useRef<IScannerControls|null>(null);
 const lookup=useCallback(async(raw:string)=>{const voucherUrl=raw.match(/\/p\/([a-f0-9-]{36})/i);
  const token=voucherUrl?.[1]||normalizeToken(raw);setError("");setSuccess("");
  if(!token){setError("El código QR o identificador no es válido.");return}
  setInput(token);
  let {data,error}=voucherUrl?await db().rpc("staff_lookup_voucher",{p_token:token}):await db().rpc("staff_lookup_card",{p_token:token});
  if(!voucherUrl&&!error&&(!data||!data.length)){const voucher=await db().rpc("staff_lookup_voucher",{p_token:token});if(!voucher.error&&voucher.data?.length){data=voucher.data;error=null;}}
  if(error){setError(error.message);setCard(null)}else if(!data?.length){setError("Tarjeta no encontrada o sin permiso para este negocio.");setCard(null)}else {
   const found=data[0] as Found;
   const [limit,choices]=await Promise.all([
    db().from("loyalty_programs").select("max_stamps_per_action").eq("business_id",found.business_id).maybeSingle(),
    db().rpc("available_rewards",{p_business:found.business_id})
   ]);
   setRewards((choices.data||[]) as RewardChoice[]);setChosen("");if(choices.error)setError(choices.error.message);
   setCard({...found,max_stamps_per_action:Number(limit.data?.max_stamps_per_action)||100});
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
 async function transact(kind:"earn"|"redeem"){if(!card)return;setBusy(true);setError("");setSuccess("");
  let result;
  if(kind==="earn"&&!card.voucher_id){result=await db().rpc("staff_award_card",{p_token:input,p_purchase_cents:Math.round(Number(amount)*100)||0,p_stamps:stamps,p_ticket_ref:receipt.trim()||null});}
  else {if(!window.confirm("¿Confirmas el canje de esta recompensa?")){setBusy(false);return}result=card.voucher_id?await db().rpc("staff_redeem_voucher_choice",{p_token:input,p_reward_option:chosen||null}):await db().rpc("staff_redeem_card_choice",{p_token:input,p_cashback_cents:card.program_type==="cashback"?Math.round(Number(cash)*100):null,p_reward_option:chosen||null})}
  setBusy(false);if(result.error){setError(result.error.message);return}
  setSuccess(kind==="earn"?"Compra registrada. Nuevo saldo: "+units(result.data,card.program_type):"Recompensa canjeada. Saldo restante: "+units(result.data,card.program_type));
  setCard(kind==="redeem"?null:{...card,balance:result.data});setReceipt("");setAmount("");setCash("");setChosen("")
 }
 return <div className="scanner-grid"><section className="panel-card"><div className="panel-icon"><ScanLine size={23}/></div><h2>Escanea una tarjeta</h2><p className="muted">Utiliza la cámara de este dispositivo o pega el contenido del QR. Necesitas una cuenta de empleado autorizada.</p>
  {scanner?<div className="camera-frame"><video ref={video} autoPlay muted playsInline/><button className="button button-outline button-sm" onClick={stopCamera}><StopCircle size={16}/> Detener</button></div>:<div className="scanner-placeholder"><ScanLine size={54}/><span>Listo para escanear</span><small>Los códigos identifican al cliente, no confirman la compra.</small></div>}
  {!scanner&&<button className="button button-dark button-full" onClick={startCamera}><Camera size={18}/> Abrir cámara</button>}
  <div className="form-divider">o introduce el código</div><form onSubmit={e=>{e.preventDefault();lookup(input)}} className="form-stack"><label>Enlace o identificador de tarjeta<input value={input} onChange={e=>setInput(e.target.value)} placeholder="Pega el enlace o UUID"/></label><button className="button button-outline button-full"><Keyboard size={18}/> Buscar tarjeta</button></form>
  
 </section>
 <section className="panel-card"><div className="panel-icon peach"><Ticket size={22}/></div><h2>Registrar la compra</h2><p className="muted">Los datos del cliente aparecerán cuando escanees su tarjeta.</p>
 {error&&<div className="alert error">{error}</div>}{success&&<div className="alert success"><Check size={18}/>{success}</div>}
 {!card?<div className="scan-await"><ScanLine size={35}/><strong>Esperando una tarjeta</strong><p>Escanea un QR para ver el saldo y las acciones disponibles.</p></div>:<><div className="scan-found"><span>CLIENTE ENCONTRADO</span><h3>{card.customer_name||"Cliente Loyally"}</h3><p>{card.business_name}</p><strong>{units(card.balance,card.program_type)}</strong></div>
  <div className="form-stack">{card.program_type==="stamps"?<div className="staff-touch-stamps"><label>¿Cuántos sellos asignamos?</label><div className="staff-touch-stepper"><button type="button" aria-label="Restar sello" disabled={stamps<=1} onClick={()=>setStamps(n=>Math.max(1,n-1))}><Minus size={20}/></button><input aria-label="Número de sellos" min={1} max={card.max_stamps_per_action||100} type="number" value={stamps} onChange={e=>setStamps(Math.max(1,Math.min(card.max_stamps_per_action||100,Number(e.target.value)||1)))}/><button type="button" aria-label="Sumar sello" disabled={stamps>=(card.max_stamps_per_action||100)} onClick={()=>setStamps(n=>Math.min(card.max_stamps_per_action||100,n+1))}><Plus size={20}/></button></div><small>Máximo de {card.max_stamps_per_action||100} sellos por operación, según el programa.</small></div>:<label>Importe de la compra (MXN)<input type="number" value={amount} min="0.01" step="0.01" onChange={e=>setAmount(e.target.value)} placeholder="12,50"/></label>}
  {card.program_type==="stamps"&&<label>Importe de la compra (MXN, opcional)<input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Ej. 85.00"/><small>Nos permite calcular ventas e inversión frente a recompensas. Si lo omites, esa compra no tendrá importe conocido.</small></label>}
  <label>Referencia del ticket (recomendado)<input value={receipt} onChange={e=>setReceipt(e.target.value)} placeholder="Ej. T-2026-0015"/><small>Evita asignar dos veces puntos al mismo ticket si se registra la referencia.</small></label>
  <button className="button button-dark button-full" disabled={busy||!!card.voucher_id||card.program_type==="stamps"&&!(stamps>=1&&stamps<=(card.max_stamps_per_action||100))} onClick={()=>transact("earn")}><Plus size={17}/> {busy?"Guardando...":"Registrar compra / sellos"}</button>
  <div className="redeem-box staff-reward-focus"><h3>{card.voucher_id?"Canjear premio con QR de un solo uso":"Canjear recompensa"}</h3><p>{card.reward_label}</p>
  {rewards.length>0&&<div><strong>Selecciona la promoción o producto que se entrega</strong><div className="reward-choice-grid">{rewards.map(o=><button type="button" key={o.id} onClick={()=>setChosen(o.id)} className={"reward-choice"+(chosen===o.id?" selected":"")} aria-pressed={chosen===o.id}><strong>{o.label}</strong><small>Valor habitual: {(Number(o.retail_cents)/100).toFixed(2)} MXN</small></button>)}</div></div>}
  {card.program_type==="cashback"&&!card.voucher_id&&<label>Saldo a utilizar (MXN)<input type="number" min=".01" step=".01" value={cash} onChange={e=>setCash(e.target.value)} placeholder="5.00"/></label>}
  <button disabled={busy||(rewards.length>0&&!chosen)||(card.program_type!=="cashback"&&card.balance<card.reward_cost)} onClick={()=>transact("redeem")} className="button button-dark button-full"><Gift size={18}/> Canjear recompensa</button></div>
  </div></>}
 </section></div>;
}
function StaffPanel(){return <AppFrame area="staff" title="Cada visita cuenta" subtitle="Registra compras y recompensas de forma segura y en pocos segundos.">{a=><StaffMain account={a}/>}</AppFrame>}
export default function StaffPage(){return <Suspense fallback={<div className="loading-screen">Abriendo escáner...</div>}><StaffPanel/></Suspense>}
