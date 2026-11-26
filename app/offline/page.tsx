"use client";
import {useEffect,useState,useRef} from "react";
import {BrowserQRCodeReader,type IScannerControls} from "@zxing/browser";
import {QRCodeSVG} from "qrcode.react";
import {MerchantCard} from "@/components/StampCard";
import {normalizeToken} from "@/lib/format";
import {offlineAccount,offlineCards,awards,queueAward,syncAwards,removeAward,clearOfflineAccount,type OfflineAccount,type Snapshot,type Award} from "@/lib/client/offline";
export default function Offline(){
 const [account,setAccount]=useState<OfflineAccount|null>(null),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[ready,setReady]=useState(false),[selected,setSelected]=useState(""),[business,setBusiness]=useState(""),[token,setToken]=useState(""),[stamps,setStamps]=useState("1"),[amount,setAmount]=useState(""),[ticket,setTicket]=useState(""),[message,setMessage]=useState(""),[pending,setPending]=useState<Award[]>([]),[online,setOnline]=useState(false),[scanning,setScanning]=useState(false),[syncing,setSyncing]=useState(false);
 const video=useRef<HTMLVideoElement>(null),controls=useRef<IScannerControls|null>(null);
 useEffect(()=>{const a=offlineAccount();setAccount(a);setSnapshot(offlineCards());setBusiness(a?.businesses[0]?.id||"");setPending(a?awards(a.id):[]);setOnline(navigator.onLine);setReady(true);
 const change=()=>setOnline(navigator.onLine);window.addEventListener("online",change);window.addEventListener("offline",change);return()=>{window.removeEventListener("online",change);window.removeEventListener("offline",change)}},[]);
 useEffect(()=>{if(!scanning||!video.current)return;let cancelled=false;new BrowserQRCodeReader().decodeFromVideoDevice(undefined,video.current,result=>{if(result&&!cancelled){setToken(result.getText());setScanning(false)}}).then(c=>{if(cancelled)c.stop();else controls.current=c}).catch(()=>{setScanning(false);setMessage("No se pudo abrir la cámara. Introduce el identificador.")});return()=>{cancelled=true;controls.current?.stop();controls.current=null}},[scanning]);
 const program=account?.businesses.find(b=>b.id===business)?.program;
 const card=snapshot?.cards.find(c=>c.id===selected);
 async function sync(){if(!account||syncing)return;setSyncing(true);await syncAwards(account.id);setPending(awards(account.id));setSyncing(false)}
 useEffect(()=>{if(online&&account?.area==="staff")void sync()},[online,account]);
 function save(){try{if(!account||!program)throw Error("No hay reglas del programa guardadas. Conecta primero.");if(/\/p\//i.test(token))throw Error("No se pueden canjear premios sin conexión.");
 const t=normalizeToken(token);if(!t)throw Error("Identificador de tarjeta no válido.");
 const monetary=program.type!=="stamps"||program.require_purchase_amount;
 const cents=monetary?Math.round(Number(amount)*100):0,n=program.type==="stamps"?Number(stamps):1;
 if(!Number.isInteger(n)||n<1||n>program.max_stamps_per_action)throw Error("Sellos fuera del límite.");
 if(!Number.isFinite(cents)||cents<0||cents>program.max_ticket_cents||(monetary&&cents<1))throw Error("Importe no válido.");
 if(program.require_ticket_reference&&!ticket.trim())throw Error("Introduce la referencia del ticket.");
 queueAward({actor:account.id,business,token:t,amount:cents,stamps:n,ticket:ticket.trim()||null});
 setPending(awards(account.id));setToken("");setAmount("");setTicket("");setStamps("1");setMessage("Compra guardada en este dispositivo. Pendiente de validación y sincronización.");
 }catch(e){setMessage((e as Error).message)}}
 if(!ready)return <main className="empty-page">Preparando tarjetas guardadas…</main>;
 return <main style={{maxWidth:680,margin:"auto",padding:"24px 16px 96px"}}><h1>{account?.area==="staff"?"Caja sin conexión":"Mis tarjetas"}</h1>
 <p role="status">{online?"Conexión recuperada. Puedes volver a tu espacio.":"Sin conexión"} · Los saldos guardados no están actualizados.</p>
 {account?.area==="customer"&&snapshot?<><p className="muted">Última actualización: {new Date(snapshot.at).toLocaleString("es-MX")}</p>
 {card?<section className="panel-card"><button className="button button-outline" onClick={()=>setSelected("")}>Volver a mis tarjetas</button><h2>{card.businesses.name}</h2><MerchantCard business={card.businesses} program={snapshot.programs.find(p=>p.business_id===card.business_id)} balance={card.balance}/><div style={{textAlign:"center",background:"#fff",padding:16,marginTop:16}}><QRCodeSVG value={"https://kreyvi.com/t/"+card.card_token} size={Math.min(300,typeof window!=="undefined"?window.innerWidth-70:260)} marginSize={4} level="M"/></div><p>Enseña este QR para registrar la compra. Los canjes se verifican online.</p></section>:<div style={{display:"grid",gap:12}}>{snapshot.cards.map(c=><button key={c.id} type="button" onClick={()=>setSelected(c.id)} style={{border:0,background:"transparent",padding:0,textAlign:"left",cursor:"pointer"}}><MerchantCard business={c.businesses} program={snapshot.programs.find(p=>p.business_id===c.business_id)} balance={c.balance}/><span>Mostrar QR</span></button>)}</div>}</>:account?.area==="staff"?<section className="panel-card form-stack">
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
 </section>:<p>No hay datos guardados o ha caducado el acceso offline. Abre KREYVI con conexión para prepararlo.</p>}
 <p><a className="button button-dark" href={account?.area==="staff"?"/empleado":"/app"}>Volver a mi espacio</a></p>
 {account&&<button className="button button-outline" onClick={()=>{if(confirm("¿Ocultar las tarjetas y cerrar el acceso offline en este dispositivo? Las compras pendientes se conservan para tu cuenta.")){clearOfflineAccount();setAccount(null);setSnapshot(null)}}}>Cerrar acceso offline</button>}</main>
}
