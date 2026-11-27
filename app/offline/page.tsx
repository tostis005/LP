"use client";
import {useEffect,useState,useRef} from "react";
import {BrowserQRCodeReader,type IScannerControls} from "@zxing/browser";
import {CachedCustomerSpace} from "@/components/CachedCustomerSpace";
import {db} from "@/lib/supabase";
import {normalizeToken} from "@/lib/format";
import {offlineAccount,awards,queueAward,syncAwards,removeAward,clearOfflineAccount,saveAccount,type OfflineAccount,type Award} from "@/lib/client/offline";
export default function Offline(){
 const [account,setAccount]=useState<OfflineAccount|null>(null),[ready,setReady]=useState(false),[business,setBusiness]=useState(""),[token,setToken]=useState(""),[stamps,setStamps]=useState("1"),[amount,setAmount]=useState(""),[ticket,setTicket]=useState(""),[message,setMessage]=useState(""),[pending,setPending]=useState<Award[]>([]),[online,setOnline]=useState(false),[scanning,setScanning]=useState(false),[syncing,setSyncing]=useState(false);
 const video=useRef<HTMLVideoElement>(null),controls=useRef<IScannerControls|null>(null);
 useEffect(()=>{const a=offlineAccount();setAccount(a);setBusiness(a?.businesses[0]?.id||"");setPending(a?awards(a.id):[]);setOnline(navigator.onLine);try{const scanned=sessionStorage.getItem("kreyvi-offline-scan");if(scanned&&a?.area==="staff")setToken(scanned);sessionStorage.removeItem("kreyvi-offline-scan")}catch{}setReady(true);
 const change=()=>setOnline(navigator.onLine);window.addEventListener("online",change);window.addEventListener("offline",change);return()=>{window.removeEventListener("online",change);window.removeEventListener("offline",change)}},[]);
 // An installation without a saved account must never remain in the offline shell.
 useEffect(()=>{
  if(!ready||account)return;
  let live=true,running=false;
  const recover=async()=>{
   if(!live||running||!navigator.onLine||document.visibilityState==="hidden")return;
   running=true;
   try{
    const res=await fetch("/entrar",{cache:"no-store",credentials:"same-origin"});
    if(live&&res.ok&&res.headers.get("Content-Type")?.includes("text/html"))window.location.replace("/entrar");
   }catch{}finally{running=false}
  };
  void recover();window.addEventListener("online",recover);window.addEventListener("focus",recover);
  document.addEventListener("visibilitychange",recover);
  const timer=window.setInterval(recover,10000);
  return()=>{live=false;window.removeEventListener("online",recover);window.removeEventListener("focus",recover);document.removeEventListener("visibilitychange",recover);window.clearInterval(timer)};
 },[ready,account]);
 useEffect(()=>{if(!scanning||!video.current)return;let cancelled=false;new BrowserQRCodeReader().decodeFromVideoDevice(undefined,video.current,result=>{if(result&&!cancelled){setToken(result.getText());setScanning(false)}}).then(c=>{if(cancelled)c.stop();else controls.current=c}).catch(()=>{setScanning(false);setMessage("No se pudo abrir la cámara. Introduce el identificador.")});return()=>{cancelled=true;controls.current?.stop();controls.current=null}},[scanning]);
 const program=account?.businesses.find(b=>b.id===business)?.program;
 async function sync(){if(!account||syncing)return;setSyncing(true);await syncAwards(account.id);setPending(awards(account.id));setSyncing(false)}
 useEffect(()=>{if(!online||!account||account.area!=="staff")return;let live=true;db().auth.getUser().then(r=>{if(!live||r.error)return;if(r.data?.user?.id!==account.id){clearOfflineAccount();setAccount(null);setPending([]);return}if(account.area==="staff"){void sync();void db().rpc("staff_offline_access").then(v=>{if(!live||v.error)return;const active=(v.data||[]) as {business_id:string;revision:string}[];const allowed=account.businesses.filter(b=>active.some(a=>a.business_id===b.id&&a.revision===b.revision));if(allowed.length!==account.businesses.length){const next={...account,businesses:allowed};saveAccount(next);setAccount(next);setBusiness(allowed[0]?.id||"");setMessage("Los permisos del establecimiento han cambiado. Las compras no autorizadas no se confirmarán.")}})}});return()=>{live=false}},[online,account]);
 function save(){try{if(!account||!program)throw Error("No hay reglas del programa guardadas. Conecta primero.");if(/\/p\//i.test(token))throw Error("No se pueden canjear premios sin conexión.");
 const t=normalizeToken(token);if(!t)throw Error("Identificador de tarjeta no válido.");
 const monetary=program.type!=="stamps"||program.require_purchase_amount;
 const cents=monetary?Math.round(Number(amount)*100):0,n=program.type==="stamps"?Number(stamps):1;
 if(!Number.isInteger(n)||n<1||n>program.max_stamps_per_action)throw Error("Sellos fuera del límite.");
 if(!Number.isFinite(cents)||cents<0||cents>program.max_ticket_cents||(monetary&&cents<1))throw Error("Importe no válido.");
 if(program.require_ticket_reference&&!ticket.trim())throw Error("Introduce la referencia del ticket.");
 queueAward({actor:account.id,business,token:t,amount:cents,stamps:n,ticket:ticket.trim()||null});
 setPending(awards(account.id));setToken("");setAmount("");setTicket("");setStamps("1");setMessage("Compra guardada en este dispositivo. Pendiente de validación y sincronización.");if(navigator.onLine)void sync();
 }catch(e){setMessage((e as Error).message)}}
 if(!ready)return <main className="empty-page">Preparando tu espacio…</main>;
 if(account?.area==="customer")return <CachedCustomerSpace recover/>;
 if(!account)return <main className="empty-page"><h1>Bienvenido a KREYVI</h1><p>Accede a tu cuenta para ver tus tarjetas.</p><a className="button button-dark" href="/entrar">Iniciar sesión</a></main>;
 return <main style={{maxWidth:680,margin:"auto",padding:"24px 16px 96px"}}><h1>{account?.area==="staff"?"Caja sin conexión":"Mis tarjetas"}</h1>

 {account?.area==="staff"?<section className="panel-card form-stack">
 <label>Establecimiento<select value={business} onChange={e=>setBusiness(e.target.value)}>{account.businesses.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
 {scanning?<><video ref={video} autoPlay muted playsInline style={{width:"100%"}}/><button className="button button-outline" onClick={()=>setScanning(false)}>Detener cámara</button></>:<button className="button button-dark" onClick={()=>setScanning(true)}>Escanear QR</button>}
 <label>Identificador de tarjeta<input value={token} onChange={e=>setToken(e.target.value)} placeholder="QR o identificador"/></label>
 {program?.type==="stamps"&&<label>Sellos<input type="number" min="1" max={program.max_stamps_per_action} value={stamps} onChange={e=>setStamps(e.target.value)}/></label>}
 {program&&(program.type!=="stamps"||program.require_purchase_amount)&&<label>Importe de la compra<input type="number" min=".01" step=".01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
 <label>Referencia del ticket {program?.require_ticket_reference?"(obligatoria)":""}<input value={ticket} maxLength={100} onChange={e=>setTicket(e.target.value)}/></label>
 <button className="button button-dark" disabled={!program||!token} onClick={save}>Guardar compra pendiente</button>
 <p role="status">{message}</p><h2>Compras pendientes ({pending.length})</h2>
 {pending.map(a=><div key={a.id} className="activity-row"><div><strong>{a.error?"Requiere revisión":"Pendiente"}</strong><p>{new Date(a.at).toLocaleString("es-MX")} · {a.ticket||"Sin referencia"}{a.error?" · "+a.error:""}</p></div>{a.error&&<button className="button button-outline" onClick={()=>{if(confirm("¿Descartar esta operación rechazada?")){removeAward(a);setPending(awards(account.id))}}}>Descartar</button>}</div>)}
 <button className="button button-outline" disabled={!online||syncing} onClick={()=>void sync()}>{syncing?"Sincronizando…":"Sincronizar compras"}</button>
 <p className="tiny-note">Las compras se validan al volver a conectar. No se permiten canjes offline.</p>
 </section>:<p>No hay datos guardados. Abre KREYVI con conexión para prepararlo.</p>}
 <p><a className="button button-dark" href={account?.area==="staff"?"/empleado":"/app"}>Volver a mi espacio</a></p>
 {account&&<button className="button button-outline" onClick={()=>{if(confirm("¿Ocultar las tarjetas y cerrar el acceso offline en este dispositivo? Las compras pendientes se conservan para tu cuenta.")){clearOfflineAccount();setAccount(null);}}}>Cerrar acceso offline</button>}</main>
}
