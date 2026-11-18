"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useSearchParams} from "next/navigation";
import {Suspense} from "react";
import {BrowserQRCodeReader,type IScannerControls} from "@zxing/browser";
import {Camera,Check,Gift,Keyboard,Plus,RefreshCw,ScanLine,ShieldCheck,StopCircle,Ticket} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {db} from "@/lib/supabase";
import {normalizeToken,units} from "@/lib/format";
type Found={membership_id:string;business_id:string;business_name:string;customer_name:string;program_type:"stamps"|"points"|"cashback";balance:number;reward_label:string;reward_cost:number};
function StaffMain({account}:{account:Account}){
 const params=useSearchParams(),[input,setInput]=useState(""),[card,setCard]=useState<Found|null>(null),[receipt,setReceipt]=useState(""),[stamps,setStamps]=useState(1),[amount,setAmount]=useState(""),[cash,setCash]=useState(""),[busy,setBusy]=useState(false),[scanner,setScanner]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const video=useRef<HTMLVideoElement>(null),controls=useRef<IScannerControls|null>(null);
 const lookup=useCallback(async(raw:string)=>{const token=normalizeToken(raw);setError("");setSuccess("");
  if(!token){setError("El código QR o identificador no es válido.");return}
  setInput(token);const {data,error}=await db().rpc("staff_lookup_card",{p_token:token});
  if(error){setError(error.message);setCard(null)}else if(!data?.length){setError("Tarjeta no encontrada o sin permiso para este negocio.");setCard(null)}else setCard(data[0] as Found);
 },[]);
 useEffect(()=>{const code=params.get("code");if(code)lookup(code)},[lookup,params]);
 async function startCamera(){setError("");setScanner(true);try{const reader=new BrowserQRCodeReader();
  controls.current=await reader.decodeFromVideoDevice(undefined,video.current!,result=>{if(result){controls.current?.stop();controls.current=null;setScanner(false);lookup(result.getText())}});
 }catch(e){setScanner(false);setError("No se ha podido abrir la cámara. Revisa los permisos del navegador o introduce el código manualmente.")}}
 function stopCamera(){controls.current?.stop();controls.current=null;setScanner(false)}
 useEffect(()=>()=>{controls.current?.stop()},[]);
 async function transact(kind:"earn"|"redeem"){if(!card)return;setBusy(true);setError("");setSuccess("");
  let result;
  if(kind==="earn"){result=await db().rpc("staff_award_card",{p_token:input,p_purchase_cents:Math.round(Number(amount)*100)||0,p_stamps:stamps,p_ticket_ref:receipt.trim()||null});}
  else {if(!window.confirm("¿Confirmas el canje de esta recompensa?")){setBusy(false);return}result=await db().rpc("staff_redeem_card",{p_token:input,p_cashback_cents:card.program_type==="cashback"?Math.round(Number(cash)*100):null})}
  setBusy(false);if(result.error){setError(result.error.message);return}
  setSuccess(kind==="earn"?"Compra registrada. Nuevo saldo: "+units(result.data,card.program_type):"Recompensa canjeada. Saldo restante: "+units(result.data,card.program_type));
  setCard({...card,balance:result.data});setReceipt("");setAmount("");setCash("")
 }
 return <div className="scanner-grid"><section className="panel-card"><div className="panel-icon"><ScanLine size={23}/></div><h2>Escanea una tarjeta</h2><p className="muted">Utiliza la cámara de este dispositivo o pega el contenido del QR. Necesitas una cuenta de empleado autorizada.</p>
  {scanner?<div className="camera-frame"><video ref={video} autoPlay muted playsInline/><button className="button button-outline button-sm" onClick={stopCamera}><StopCircle size={16}/> Detener</button></div>:<div className="scanner-placeholder"><ScanLine size={54}/><span>Listo para escanear</span><small>Los códigos identifican al cliente, no confirman la compra.</small></div>}
  {!scanner&&<button className="button button-dark button-full" onClick={startCamera}><Camera size={18}/> Abrir cámara</button>}
  <div className="form-divider">o introduce el código</div><form onSubmit={e=>{e.preventDefault();lookup(input)}} className="form-stack"><label>Enlace o identificador de tarjeta<input value={input} onChange={e=>setInput(e.target.value)} placeholder="Pega el enlace o UUID"/></label><button className="button button-outline button-full"><Keyboard size={18}/> Buscar tarjeta</button></form>
  <div className="scanner-security"><ShieldCheck size={18}/><span>Acceso autenticado, límites por operación e historial de movimientos.</span></div>
 </section>
 <section className="panel-card"><div className="panel-icon peach"><Ticket size={22}/></div><h2>Registrar la compra</h2><p className="muted">Los datos del cliente aparecerán cuando escanees su tarjeta.</p>
 {error&&<div className="alert error">{error}</div>}{success&&<div className="alert success"><Check size={18}/>{success}</div>}
 {!card?<div className="scan-await"><ScanLine size={35}/><strong>Esperando una tarjeta</strong><p>Escanea un QR para ver el saldo y las acciones disponibles.</p></div>:<><div className="scan-found"><span>CLIENTE ENCONTRADO</span><h3>{card.customer_name||"Cliente LP"}</h3><p>{card.business_name}</p><strong>{units(card.balance,card.program_type)}</strong></div>
  <div className="form-stack">{card.program_type==="stamps"?<label>Sellos a registrar<input min={1} max={100} type="number" value={stamps} onChange={e=>setStamps(Number(e.target.value))}/></label>:<label>Importe de la compra (€)<input type="number" value={amount} min="0.01" step="0.01" onChange={e=>setAmount(e.target.value)} placeholder="12,50"/></label>}
  <label>Referencia del ticket (recomendado)<input value={receipt} onChange={e=>setReceipt(e.target.value)} placeholder="Ej. T-2026-0015"/><small>Evita asignar dos veces puntos al mismo ticket si se registra la referencia.</small></label>
  <button className="button button-dark button-full" disabled={busy} onClick={()=>transact("earn")}><Plus size={17}/> {busy?"Guardando...":"Registrar compra / sellos"}</button>
  <div className="redeem-box"><h3>Canjear recompensa</h3><p>{card.reward_label}</p>{card.program_type==="cashback"&&<label>Cashback a utilizar (€)<input type="number" min=".01" step=".01" value={cash} onChange={e=>setCash(e.target.value)} placeholder="5.00"/></label>}
  <button disabled={busy||(card.program_type!=="cashback"&&card.balance<card.reward_cost)} onClick={()=>transact("redeem")} className="button button-outline button-full"><Gift size={18}/> Canjear recompensa</button></div>
  </div></>}
 </section></div>;
}
function StaffPanel(){return <AppFrame area="staff" title="Cada visita cuenta" subtitle="Registra compras y recompensas de forma segura y en pocos segundos.">{a=><StaffMain account={a}/>}</AppFrame>}
export default function StaffPage(){return <Suspense fallback={<div className="loading-screen">Abriendo escáner...</div>}><StaffPanel/></Suspense>}
