"use client";
import {useEffect,useState} from "react";
import {Upload,Search} from "lucide-react";
type Prospect={id:string;name:string;email:string|null;public_email:string|null;public_email_source:string|null;public_email_checked_at:string|null;contact_review:string;contact_review_url:string|null;contact_reviewed_at:string|null;state:string;municipality:string;city:string;category:string;activity:string;status:string;notes:string};
type Region={country_code:string;state_code:string;state:string;municipality_code:string;municipality:string;locality_code:string;city:string;total:number};
type Count={total:number;relevant:number;withEmail:number;missingOrInvalidEmail:number;uniqueEmails:number};
type Report=Count&{duplicates:number;skipped:number;byCity:Array<Count&{state:string;municipality:string;city:string;state_code:string;municipality_code:string;locality_code:string}>;bySector:Array<Count&{category:string}>};
type Data={prospects:Prospect[];count:{total:number;unique_emails:number;with_email:number;missing_email:number;reviewed:number};regions:Region[];categories:Array<{category:string;total:number}>;imports:Array<{filename:string;created_at:string;report:Report}>;page:number};
const stages:Record<string,string>={pending_review:"Por revisar",qualified:"Cualificado",contacted:"Contactado",interested:"Interesado",trial:"En prueba",converted:"Cliente",discarded:"Descartado",do_not_contact:"No contactar"};
const reviewStages:Record<string,string>={pending:"Pendiente",source_found:"Fuente localizada",no_contact_found:"Sin contacto localizado",ambiguous:"Identidad dudosa",not_relevant:"No relevante"};
export function AdminCrm(){
 const [data,setData]=useState<Data|null>(null),[report,setReport]=useState<Report|null>(null),[file,setFile]=useState<File|null>(null);
 const [review,setReview]=useState(""),[coverage,setCoverage]=useState(""),[country,setCountry]=useState("MX"),[state,setState]=useState("02"),[municipality,setMunicipality]=useState("003"),[city,setCity]=useState(""),[category,setCategory]=useState("pilot_food"),[status,setStatus]=useState(""),[search,setSearch]=useState(""),[page,setPage]=useState(0),[scope,setScope]=useState("02003");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[revision,setRevision]=useState(0),[focus,setFocus]=useState<Prospect|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  const params=new URLSearchParams({country_code:country,state_code:state,municipality_code:municipality,locality_code:city,category,status,coverage,review,q:search,page:String(page)});
  fetch("/api/local/admin/crm?"+params,{signal:controller.signal,cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);setData(j);}).catch(e=>{if(e.name!=="AbortError")setError(e.message);});
  return()=>controller.abort();
 },[country,state,municipality,city,category,status,coverage,review,search,page,revision]);
 const regions=data?.regions||[],states=[...new Map(regions.filter(r=>!country||r.country_code===country).map(r=>[r.state_code,r.state])).entries()];
 const municipalities=[...new Map(regions.filter(r=>r.state_code===state).map(r=>[r.municipality_code,r.municipality])).entries()];
 const cities=regions.filter(r=>r.state_code===state&&r.municipality_code===municipality);
 async function upload(mode:"preview"|"import"){
  if(!file)return;
  setBusy(true);setError("");setNotice("");
  try{
   const body=new FormData();body.append("file",file);body.append("mode",mode);body.append("municipality",scope);
   const r=await fetch("/api/local/admin/crm",{method:"POST",body}),j=await r.json();
   if(!r.ok)throw new Error(j.error||"No se pudo procesar el archivo.");
   setReport(j.report);
   if(mode==="import"){setNotice(j.imported+" registros incorporados o actualizados. No se ha enviado ningún correo.");setPage(0);setRevision(x=>x+1);}
  }catch(e){setError(e instanceof Error?e.message:"Error de importación.");}finally{setBusy(false);}
 }
 async function save(){
  if(!focus)return;setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/local/admin/crm",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:focus.id,status:focus.status,notes:focus.notes,public_email:focus.public_email||"",public_email_source:focus.public_email_source||"",contact_review:focus.contact_review,contact_review_url:focus.contact_review_url||""})});
   const j=await r.json();if(!r.ok)throw new Error(j.error);setFocus(null);setRevision(x=>x+1);setNotice("Ficha actualizada.");
  }catch(e){setError(e instanceof Error?e.message:"Error al guardar.");}finally{setBusy(false);}
 }
 const analysis=report||data?.imports[0]?.report;
 return <div className="panel-card">
  <div className="content-heading"><div><h2>CRM comercial</h2><p>Prospectos por país, estado, municipio y ciudad. La importación no activa envíos.</p></div></div>
  {error&&<div role="alert" className="alert error">{error}</div>}{notice&&<div role="status" className="alert success">{notice}</div>}
  <div className="inspector-stats"><div><strong>{data?.count.total??"—"}</strong><span>Prospectos filtrados</span></div><div><strong>{data?.count.unique_emails??"—"}</strong><span>Correos distintos</span></div><div><strong>{data?.count.with_email??"—"}</strong><span>Con correo</span></div><div><strong>{data?.count.missing_email??"—"}</strong><span>Sin correo</span></div><div><strong>{data?.count.reviewed??"—"}</strong><span>Revisados</span></div></div>
  <details><summary><strong><Upload size={16}/> Importar y analizar DENUE</strong></summary>
   <p>Descarga el CSV oficial de INEGI, descomprímelo y selecciona el archivo. Se admite UTF-8 y Windows-1252, hasta 40 MB por archivo. No se publican los contactos en GitHub.</p>
   <a href="https://www.inegi.org.mx/app/descarga/" target="_blank" rel="noreferrer">Descarga oficial del DENUE</a>
   <div className="form-stack">
    <label>Municipio a analizar (clave INEGI de 5 cifras; vacío = todos)<input value={scope} onChange={e=>{setScope(e.target.value);setReport(null)}} placeholder="02003 (Tecate)" maxLength={5}/></label>
    <label>Archivo CSV<input type="file" accept=".csv,text/csv" onChange={e=>{setFile(e.target.files?.[0]||null);setReport(null)}}/></label>
    <button className="button button-outline button-sm" disabled={busy||!file} onClick={()=>upload("preview")}>Analizar sin guardar</button>
    <button className="button button-dark button-sm" disabled={busy||!file||!report||!report.relevant} onClick={()=>upload("import")}>Importar prospectos para revisión</button>
   </div>
  </details>
  {analysis&&<div className="admin-inspector"><h3>Análisis DENUE {report?"· archivo seleccionado":"· última importación"}</h3>
   <div className="inspector-stats"><div><strong>{analysis.total.toLocaleString("es-MX")}</strong><span>Establecimientos</span></div><div><strong>{analysis.relevant.toLocaleString("es-MX")}</strong><span>Compatibles por actividad</span></div><div><strong>{analysis.withEmail.toLocaleString("es-MX")}</strong><span>Con correo de formato válido</span></div><div><strong>{analysis.uniqueEmails.toLocaleString("es-MX")}</strong><span>Correos distintos</span></div></div>
   <p className="muted">Sin correo válido: {analysis.missingOrInvalidEmail}. Duplicados de ID: {analysis.duplicates}. Registros incompletos: {analysis.skipped}. Correo publicado no equivale a permiso de envío ni a buzón verificado.</p>
   <div className="table-wrap"><table className="data-table"><thead><tr><th>Estado / municipio / localidad</th><th>Total</th><th>Compatibles</th><th>Con correo</th><th>Correos únicos</th></tr></thead><tbody>{analysis.byCity.map(r=><tr key={r.state_code+r.municipality_code+r.locality_code}><td>{r.state} / {r.municipality} / {r.city}</td><td>{r.total}</td><td>{r.relevant}</td><td>{r.withEmail}</td><td>{r.uniqueEmails}</td></tr>)}</tbody></table></div>
   <div className="table-wrap"><table className="data-table"><thead><tr><th>Sector</th><th>Compatibles</th><th>Con correo</th><th>Correos únicos</th></tr></thead><tbody>{analysis.bySector.map(s=><tr key={s.category}><td>{s.category}</td><td>{s.relevant}</td><td>{s.withEmail}</td><td>{s.uniqueEmails}</td></tr>)}</tbody></table></div>
  </div>}
  <div className="form-stack">
   <label>País<select value={country} onChange={e=>{setCountry(e.target.value);setState("");setMunicipality("");setCity("");setPage(0)}}><option value="">Todos</option><option value="MX">México</option></select></label>
   <label>Estado<select value={state} onChange={e=>{setState(e.target.value);setMunicipality("");setCity("");setPage(0)}}><option value="">Todos</option>{states.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
   <label>Municipio<select value={municipality} disabled={!state} onChange={e=>{setMunicipality(e.target.value);setCity("");setPage(0)}}><option value="">Todos</option>{municipalities.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
   <label>Ciudad / localidad<select value={city} disabled={!municipality} onChange={e=>{setCity(e.target.value);setPage(0)}}><option value="">Todas</option>{cities.map(r=><option key={r.locality_code} value={r.locality_code}>{r.city} ({r.total})</option>)}</select></label>
   <label>Sector<select value={category} onChange={e=>{setCategory(e.target.value);setPage(0)}}><option value="pilot_food">Piloto: restauración, cafeterías y heladerías</option><option value="">Todos</option>{data?.categories.map(c=><option key={c.category}>{c.category}</option>)}</select></label>
   <label>Disponibilidad de correo<select value={coverage} onChange={e=>{setCoverage(e.target.value);setPage(0)}}><option value="">Todos</option><option value="available">Con correo publicado</option><option value="missing">Sin correo localizado</option><option value="web">Con fuente externa registrada</option></select></label>
   <label>Revisión de contacto<select value={review} onChange={e=>{setReview(e.target.value);setPage(0)}}><option value="">Todos</option>{Object.entries(reviewStages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
   <label>Estado comercial<select value={status} onChange={e=>{setStatus(e.target.value);setPage(0)}}><option value="">Todos</option>{Object.entries(stages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
   <div className="search-box small-search"><Search size={17}/><input aria-label="Buscar prospectos" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} placeholder="Nombre o correo"/></div>
  </div>
  <div className="table-wrap"><table className="data-table"><thead><tr><th>Negocio</th><th>Ubicación</th><th>Sector</th><th>Correo</th><th>Estado</th><th></th></tr></thead><tbody>{data?.prospects.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.city}<small>{p.municipality}, {p.state}</small></td><td>{p.category}</td><td>{p.email||p.public_email||"Sin localizar"}<small>{p.email?"DENUE":p.public_email?"Fuente externa":"Pendiente"}</small></td><td>{stages[p.status]}<small>{reviewStages[p.contact_review]}</small></td><td><button className="inline-table-button" onClick={()=>setFocus({...p})}>Ficha</button></td></tr>)}</tbody></table></div>
  {!data?.prospects.length&&<p className="muted">{data?"No hay prospectos con estos filtros.":"Cargando prospectos…"}</p>}
  <div className="content-heading"><button className="button button-outline button-sm" disabled={page===0} onClick={()=>setPage(x=>x-1)}>Anterior</button><span>Página {page+1}</span><button className="button button-outline button-sm" disabled={(page+1)*50>=(data?.count.total||0)} onClick={()=>setPage(x=>x+1)}>Siguiente</button></div>
  {focus&&<div className="admin-inspector"><div className="inspector-head"><div><strong>{focus.name}</strong><small>{focus.email} · {focus.activity}</small></div><button className="inline-table-button" onClick={()=>setFocus(null)}>Cerrar</button></div><div className="form-stack">
   <label>Estado<select disabled={focus.status==="do_not_contact"} value={focus.status} onChange={e=>setFocus({...focus,status:e.target.value})}>{Object.entries(stages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
   <p>Correo original DENUE: {focus.email||"No publicado"}</p>
   <label>Correo comercial publicado en otra fuente<input type="email" value={focus.public_email||""} onChange={e=>setFocus({...focus,public_email:e.target.value})} disabled={busy||focus.status==="do_not_contact"}/></label>
   <label>URL de la fuente pública<input type="url" value={focus.public_email_source||""} onChange={e=>setFocus({...focus,public_email_source:e.target.value})} disabled={busy||focus.status==="do_not_contact"}/></label>
   {focus.public_email_checked_at&&<small>Fuente registrada: {new Date(focus.public_email_checked_at).toLocaleDateString("es-MX")}</small>}
   <p className="muted">La presencia de un correo publicado no confirma vigencia, entregabilidad ni permiso de envío.</p>
   <label>Resultado de revisión<select value={focus.contact_review} onChange={e=>setFocus({...focus,contact_review:e.target.value})}>{Object.entries(reviewStages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
   <label>Fuente revisada (URL)<input type="url" value={focus.contact_review_url||""} onChange={e=>setFocus({...focus,contact_review_url:e.target.value})}/></label>
   {focus.contact_reviewed_at&&<small>Última revisión: {new Date(focus.contact_reviewed_at).toLocaleDateString("es-MX")}</small>}
   <label>Notas<textarea maxLength={2000} value={focus.notes} onChange={e=>setFocus({...focus,notes:e.target.value})}/></label>
   <button className="button button-dark button-sm" disabled={busy} onClick={save}>Guardar ficha</button>
  </div></div>}
 </div>;
}
