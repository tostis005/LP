"use client";
import {useCallback,useEffect,useState} from "react";
import {Check,Download,ReceiptText,RefreshCcw} from "lucide-react";
type Charge={offer_id:string;business_id:string;business_name:string;offer_title:string;
 channel:"email"|"whatsapp"|"push";recipients:number;unit_price_cents:number;amount_cents:string;
 currency:string;confirmed_at:string;invoiced_at:string|null;invoice_reference:string|null};
async function json(path:string,init?:RequestInit){
 const r=await fetch(path,{credentials:"same-origin",cache:"no-store",...init});
 const data=await r.json() as {charges?:Charge[];error?:string;ok?:boolean};
 if(!r.ok||data.error)throw new Error(data.error||"No se pudo completar la operación");
 return data;
}
function money(value:number,currency:string){
 return new Intl.NumberFormat("es-MX",{style:"currency",currency}).format(value/100);
}
export function AdminCampaignCharges(){
 const [rows,setRows]=useState<Charge[]>([]),[all,setAll]=useState(false);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{const r=await json("/api/local/admin/campaign-charges?all="+String(all));setRows(r.charges||[])}
  catch(e){setError((e as Error).message)}finally{setLoading(false)}
 },[all]);
 useEffect(()=>{void refresh()},[refresh]);
 async function mark(id:string){
  const reference=window.prompt("Introduce el número de factura externa emitida para esta campaña:");
  if(!reference)return;
  if(reference.trim().length<3||reference.trim().length>100){setError("La referencia debe tener entre 3 y 100 caracteres.");return}
  if(!window.confirm("¿Marcar como facturados todos los canales de esta campaña con la referencia "+reference.trim()+"?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   await json("/api/local/admin/campaign-charges",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({offer_id:id,invoice_reference:reference.trim()})});
   setNotice("Cargos marcados como facturados con la referencia "+reference.trim()+".");
   await refresh();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 const groups=Object.values(rows.reduce<Record<string,{id:string;name:string;title:string;currency:string;date:string;
  total:number;lines:Charge[];invoiced:boolean}>>((map,c)=>{
  const group=map[c.offer_id]??{id:c.offer_id,name:c.business_name,title:c.offer_title,
   currency:c.currency,date:c.confirmed_at,total:0,lines:[],invoiced:!!c.invoiced_at};
  group.total+=Number(c.amount_cents);group.lines.push(c);map[c.offer_id]=group;return map;
 },{}));
 const totalByCurrency=rows.reduce<Record<string,number>>((map,r)=>{
  map[r.currency]=(map[r.currency]||0)+Number(r.amount_cents);return map;
 },{});
 return <div className="panel-card">
  <div className="content-heading"><div><h2>Campañas para facturar</h2>
   <p>Importes confirmados, guardados por negocio y canal para su facturación posterior.</p></div>
   <div className="campaign-compose-actions">
    <button type="button" className="button button-outline button-sm" disabled={loading} onClick={()=>void refresh()}><RefreshCcw size={16}/> Actualizar</button>
    <a className="button button-dark button-sm" href={"/api/local/admin/campaign-charges?format=csv&all="+String(all)}><Download size={16}/> Exportar CSV</a>
   </div>
  </div>
  <label className="kreyv-expired-toggle"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> Mostrar también facturados</label>
  {error&&<div className="alert error" role="alert">{error}</div>}
  {notice&&<div className="alert success"><Check size={16}/>{notice}</div>}
  {!!rows.length&&<div className="campaign-overview-grid">{Object.entries(totalByCurrency).map(([currency,total])=>
   <div className="campaign-overview-stat" key={currency}><span>Importe {all?"registrado":"pendiente"} · {currency}</span><strong>{money(total,currency)}</strong><small>{rows.length} líneas de campaña</small></div>)}</div>}
  {loading?<p className="muted">Consultando cargos...</p>:groups.length?groups.map(group=>
   <div className="kreyv-invoice-group" key={group.id}>
    <div><strong>{group.name}</strong><p>{group.title}</p>
     <small>{new Date(group.date).toLocaleDateString("es-ES")} · {group.invoiced?"Facturado":"Pendiente de facturar"}</small></div>
    <div className="kreyv-invoice-lines">{group.lines.map(c=><div key={c.channel}>
     <span>{c.channel==="email"?"Correo":c.channel==="push"?"Push":"WhatsApp"} · {c.recipients} × {money(c.unit_price_cents,c.currency)}</span>
     <strong>{money(Number(c.amount_cents),c.currency)}</strong>
    </div>)}</div>
    <div className="kreyv-invoice-total"><strong>Total {money(group.total,group.currency)}</strong>
     {!group.invoiced&&<button className="button button-outline button-sm" disabled={busy} type="button"
      onClick={()=>void mark(group.id)}><ReceiptText size={16}/> Marcar facturado</button>}</div>
   </div>
  ):<p className="muted">No hay cargos {all?"registrados":"pendientes de facturar"}.</p>}
  <p className="tiny-note">Exportar o marcar un cargo no emite una factura fiscal ni realiza un cobro automático. Registra aquí la referencia de la factura que hayas emitido externamente.</p>
 </div>;
}
