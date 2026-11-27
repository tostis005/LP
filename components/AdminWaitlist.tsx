"use client";
import {useEffect,useState,useMemo} from "react";
type Entry={id:string;created_at:string;name:string;country:string;whatsapp:string;email:string|null;city:string;city_key:string;kind:"user"|"business";business_name:string|null;business_type:string|null;branches:number|null;utm_source:string|null;utm_medium:string|null;utm_campaign:string|null;utm_content:string|null;utm_term:string|null;utm_id:string|null};
const typeNames:Record<string,string>={cafe:"Café",restaurant:"Restaurante",other:"Otro"};
const countryName=(c:string)=>c==="MX"?"México":"España";
const cityId=(r:Entry)=>r.country+":"+r.city_key;
const csvCell=(v:unknown)=>{let s=String(v??"");if(/^[\s]*[=+@-]|^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
export function AdminWaitlist(){
 const [entries,setEntries]=useState<Entry[]>([]),[city,setCity]=useState(""),[kind,setKind]=useState(""),[country,setCountry]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{const controller=new AbortController();fetch("/api/local/waitlist",{signal:controller.signal,cache:"no-store"}).then(async res=>{const data=await res.json();if(!res.ok)throw new Error(data.error||"No se pudieron cargar las inscripciones.");setEntries(data.entries)}).catch(e=>{if(!controller.signal.aborted)setError(String(e.message||e))}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[]);
 const cities=useMemo(()=>{const map=new Map<string,{label:string;users:number;businesses:number}>();for(const r of entries){const key=cityId(r),v=map.get(key)||{label:r.city+" · "+countryName(r.country),users:0,businesses:0};if(r.kind==="user")v.users++;else v.businesses++;map.set(key,v)}return Array.from(map.entries()).sort((a,b)=>(b[1].users+b[1].businesses)-(a[1].users+a[1].businesses)||a[1].label.localeCompare(b[1].label))},[entries]);
 const filtered=entries.filter(r=>(!city||cityId(r)===city)&&(!kind||r.kind===kind)&&(!country||r.country===country));
 function download(){
  const headings=["Fecha","Nombre","País","WhatsApp","Correo","Ciudad","Tipo","Local","Categoría","Sucursales","utm_source","utm_medium","utm_campaign","utm_content","utm_term","utm_id"];
  const rows=filtered.map(r=>[r.created_at,r.name,countryName(r.country),r.whatsapp,r.email,r.city,r.kind==="user"?"Usuario":"Negocio",r.business_name,r.business_type?typeNames[r.business_type]:null,r.branches,r.utm_source,r.utm_medium,r.utm_campaign,r.utm_content,r.utm_term,r.utm_id]);
  const url=URL.createObjectURL(new Blob(["\ufeff"+[headings,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="kreyvi-lista-espera.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <div className="form-stack">
 <section className="panel-card"><h2>Lista de espera · Demanda por ciudad</h2><p className="muted">Inscripciones únicas por WhatsApp, separadas de las cuentas existentes.</p>
 <div className="overview-stat"><span>Total de usuarios</span><strong>{entries.filter(r=>r.kind==="user").length}</strong></div>
 <div className="overview-stat"><span>Total de negocios</span><strong>{entries.filter(r=>r.kind==="business").length}</strong></div>
 <div style={{overflowX:"auto"}}><table className="data-table"><thead><tr><th>Ciudad / país</th><th>Usuarios</th><th>Negocios</th><th>Total</th></tr></thead><tbody>{cities.map(([key,c])=><tr key={key}><td>{c.label}</td><td>{c.users}</td><td>{c.businesses}</td><td>{c.users+c.businesses}</td></tr>)}</tbody></table></div></section>
 <section className="panel-card"><h2>Solicitudes de lista de espera</h2><div className="form-stack">
 <label>País<select value={country} onChange={e=>{setCountry(e.target.value);setCity("")}}><option value="">Todos</option><option value="MX">México</option><option value="ES">España</option></select></label>
 <label>Ciudad<select value={city} onChange={e=>setCity(e.target.value)}><option value="">Todas</option>{cities.filter(([key])=>!country||key.startsWith(country+":")).map(([key,c])=><option key={key} value={key}>{c.label}</option>)}</select></label>
 <label>Tipo<select value={kind} onChange={e=>setKind(e.target.value)}><option value="">Todos</option><option value="user">Usuarios</option><option value="business">Negocios</option></select></label>
 <button type="button" className="button button-dark" disabled={!filtered.length||loading} onClick={download}>Exportar {filtered.length} registros (CSV)</button></div>
 {error&&<p role="alert">{error}</p>}{loading?<p>Cargando…</p>:<p>{filtered.length} registros</p>}
 <div style={{overflowX:"auto"}}><table className="data-table"><thead><tr><th>Fecha</th><th>Nombre</th><th>WhatsApp</th><th>Email</th><th>Ciudad</th><th>Tipo</th><th>Local</th><th>Sucursales</th><th>Origen</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleDateString("es")}</td><td>{r.name}</td><td>{r.whatsapp}</td><td>{r.email||"—"}</td><td>{r.city} · {countryName(r.country)}</td><td>{r.kind==="user"?"Usuario":"Negocio"}</td><td>{r.business_name||"—"} {r.business_type&&"· "+typeNames[r.business_type]}</td><td>{r.branches??"—"}</td><td>{[r.utm_source,r.utm_medium,r.utm_campaign].filter(Boolean).join(" / ")||"Sin UTM"}</td></tr>)}</tbody></table></div></section>
 </div>
}
