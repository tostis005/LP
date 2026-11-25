"use client";
import {useEffect,useRef,useState} from "react";
import {Upload,Search,Loader2,ArrowUp,ArrowDown,ArrowUpDown,ChevronLeft,ChevronRight,ChevronsLeft,ChevronsRight,X} from "lucide-react";
import {AdminCrmCsvLibrary} from "./AdminCrmCsvLibrary";
type Prospect={id:string;name:string;phone:string;address:string;website:string;latitude:string;longitude:string;email:string|null;public_email:string|null;public_email_source:string|null;public_email_checked_at:string|null;contact_review:string;contact_review_url:string|null;contact_reviewed_at:string|null;state:string;municipality:string;city:string;category:string;activity:string;status:string;notes:string};
type Region={country_code:string;state_code:string;state:string;municipality_code:string;municipality:string;locality_code:string;city:string;total:number};
type Count={total:number;relevant:number;withEmail:number;missingOrInvalidEmail:number;uniqueEmails:number};
type Report=Count&{duplicates:number;skipped:number;byCity:Array<Count&{state:string;municipality:string;city:string;state_code:string;municipality_code:string;locality_code:string}>;bySector:Array<Count&{category:string}>};
type Data={prospects:Prospect[];count:{total:number;unique_emails:number;with_email:number;missing_email:number;reviewed:number};regions:Region[];categories:Array<{category:string;total:number}>;imports:Array<{filename:string;created_at:string;report:Report&{edition?:string|null}}>;page:number;pageSize:number;totalPages:number};
const stages:Record<string,string>={pending_review:"Sin contactar",qualified:"Sin contactar (revisado)",contacted:"Contactado",interested:"Interesado",trial:"En prueba",converted:"Cliente",discarded:"No interesado",do_not_contact:"No contactar"};
const reviewStages:Record<string,string>={pending:"Pendiente",source_found:"Fuente localizada",no_contact_found:"Sin contacto localizado",ambiguous:"Identidad dudosa",not_relevant:"No relevante"};
export function AdminCrm(){
 const [data,setData]=useState<Data|null>(null);
 const [review,setReview]=useState(""),[coverage,setCoverage]=useState(""),[country,setCountry]=useState("MX"),[state,setState]=useState(""),[municipality,setMunicipality]=useState(""),[city,setCity]=useState(""),[category,setCategory]=useState(""),[status,setStatus]=useState(""),[search,setSearch]=useState(""),[page,setPage]=useState(0);
 const [pageSize,setPageSize]=useState(50),[sort,setSort]=useState("name"),[direction,setDirection]=useState<"asc"|"desc">("asc");
 const [columnFilters,setColumnFilters]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[jump,setJump]=useState("");
 const requestVersion=useRef(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[revision,setRevision]=useState(0),[focus,setFocus]=useState<Prospect|null>(null);
 useEffect(()=>{
  const controller=new AbortController(),version=++requestVersion.current;
  setLoading(true);setError("");
  const params=new URLSearchParams({country_code:country,state_code:state,municipality_code:municipality,locality_code:city,category,status,coverage,review,q:search,page:String(page),page_size:String(pageSize),sort,direction,...columnFilters});
  // Coalesce rapid typing/filter changes and cancel outdated requests.
  const timer=setTimeout(()=>{
   fetch("/api/local/admin/crm?"+params,{signal:controller.signal,cache:"no-store"}).then(async r=>{
    const j=await r.json();if(!r.ok)throw new Error(j.error||"No se pudo cargar el listado.");
    if(controller.signal.aborted||version!==requestVersion.current)return;
    setData(j);if(j.page!==page)setPage(j.page);
   }).catch(e=>{if(!controller.signal.aborted&&version===requestVersion.current)setError(e.message);})
   .finally(()=>{if(!controller.signal.aborted&&version===requestVersion.current)setLoading(false);});
  },180);
  return()=>{clearTimeout(timer);controller.abort();};
 },[country,state,municipality,city,category,status,coverage,review,search,page,pageSize,sort,direction,columnFilters,revision]);
 const regions=data?.regions||[],states=[...new Map(regions.filter(r=>!country||r.country_code===country).map(r=>[r.state_code,r.state])).entries()];
 const municipalities=[...new Map(regions.filter(r=>r.state_code===state).map(r=>[r.municipality_code,r.municipality])).entries()];
 async function importOfficial(code:string,name:string){
  setBusy(true);setError("");setNotice("Descargando y procesando el directorio oficial del INEGI…");
  try{
   const body=new FormData();body.append("mode","official");body.append("municipality",code);
   const r=await fetch("/api/local/admin/crm",{method:"POST",body}),j=await r.json();
   if(!r.ok)throw new Error(j.error||"No se pudo importar "+name+".");
   setColumnFilters({});setCountry("MX");setState(code.slice(0,2));setMunicipality(code.slice(2));setCity("");setCategory("");setCoverage("");setReview("");setStatus("");setSearch("");setPage(0);setRevision(x=>x+1);
   setNotice(j.alreadyImported?"El directorio de "+name+" ya está cargado.":name+": "+j.report.relevant+" negocios del sector y "+j.report.withEmail+" con correo DENUE. No se ha enviado ningún correo.");
  }catch(e){setNotice("");setError(e instanceof Error?e.message:"Error de importación oficial.");}finally{setBusy(false);}
 }
 async function save(){
  if(!focus)return;setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/local/admin/crm",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:focus.id,status:focus.status,notes:focus.notes,public_email:focus.public_email||"",public_email_source:focus.public_email_source||"",contact_review:focus.contact_review,contact_review_url:focus.contact_review_url||""})});
   const j=await r.json();if(!r.ok)throw new Error(j.error);setFocus(null);setRevision(x=>x+1);setNotice("Ficha actualizada.");
  }catch(e){setError(e instanceof Error?e.message:"Error al guardar.");}finally{setBusy(false);}
 }
 const localities=[...new Map(regions.filter(r=>r.state_code===state&&r.municipality_code===municipality).map(r=>[r.locality_code,r.city])).entries()];
 const total=data?.count.total||0,totalPages=data?.totalPages||1,shownPage=data?.page??page,shownSize=data?.pageSize??pageSize;
 const format=(n:number)=>n.toLocaleString("es-MX");
 function filterColumn(key:string,value:string){setColumnFilters(old=>{const next={...old};if(value)next[key]=value;else delete next[key];return next;});setPage(0);}
 function orderBy(key:string){setDirection(sort===key&&direction==="asc"?"desc":"asc");setSort(key);setPage(0);}
 function clearFilters(){setSearch("");setCountry("MX");setState("");setMunicipality("");setCity("");setCategory("");setCoverage("");setReview("");setStatus("");setColumnFilters({});setSort("name");setDirection("asc");setPage(0);setJump("");}
 function goPage(n:number){setPage(Math.max(0,Math.min(totalPages-1,n)));setJump("");}
 const columns=[["name","Negocio"],["state","Estado geográfico"],["municipality","Municipio"],["city","Localidad"],["category","Sector"],["activity","Actividad"],["email","Correo"],["phone","Teléfono"],["address","Dirección"],["website","Web"],["status","Estado comercial"],["review","Revisión"]] as const;
 const textColumns=new Set(["name","activity","email","phone","address","website"]);
 const hasFilters=Boolean(search||state||municipality||city||category||coverage||review||status||Object.keys(columnFilters).length);
 const pendingCities=[{code:"22014",name:"Querétaro"},{code:"21114",name:"Puebla"}].filter(x=>!regions.some(r=>r.state_code+r.municipality_code===x.code));
 return <div className="panel-card">
  <div className="content-heading"><div><h2>CRM comercial</h2><p>Busca negocios, registra el contacto y guarda notas.</p></div></div>
  {error&&<div role="alert" className="alert error">{error}</div>}{notice&&<div role="status" className="alert success">{notice}</div>}
  {data&&pendingCities.length>0&&<div className="admin-inspector"><div className="content-heading"><strong>Carga inicial de negocios</strong><small>DENUE · incluye negocios sin correo</small></div>{pendingCities.map(x=><button key={x.code} type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>void importOfficial(x.code,x.name)}><Upload size={16}/> Cargar {x.name}</button>)}</div>}
  <AdminCrmCsvLibrary onSaved={()=>{setPage(0);setRevision(x=>x+1);}}/>
  <style>{`
   @keyframes crm-list-spin{to{transform:rotate(360deg)}}
   .crm-list-spinner{animation:crm-list-spin .8s linear infinite;flex-shrink:0}
   .crm-list-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;align-items:end;margin:16px 0}
   .crm-list-filters label{display:flex;flex-direction:column;gap:5px;font-size:.85rem}
   .crm-list-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:12px 0}
   .crm-table-shell{position:relative;min-height:100px}
   .crm-table-shell .table-wrap{max-height:65vh;overflow:auto}
   .crm-table-shell th{position:sticky;top:0;z-index:1;background:var(--card,#fff)}
   .crm-table-shell th button{display:inline-flex;align-items:center;gap:6px;color:inherit;background:none;border:0;font:inherit;font-weight:600;cursor:pointer;padding:0;white-space:nowrap}
   .crm-column-filter{display:block;min-width:115px;width:100%;font-size:.78rem;margin-top:8px;padding:5px 7px;border:1px solid var(--border,#d5d5d5);border-radius:6px;background:transparent;color:inherit}
   .crm-table-shell td{vertical-align:top;max-width:260px;overflow-wrap:anywhere}
   .crm-table-shell td small{display:block}
   .crm-table-loading{position:absolute;inset:0;z-index:2;display:flex;align-items:flex-start;justify-content:center;padding-top:65px;pointer-events:none}
   .crm-table-loading span{display:flex;align-items:center;gap:10px;border:1px solid var(--border,#ddd);border-radius:999px;background:var(--card,#fff);padding:10px 16px;box-shadow:0 4px 18px #0002}
   .crm-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:16px}
   .crm-pagination-group{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
   .crm-pagination-group select,.crm-pagination-group input{max-width:100px}
   .crm-pagination-group button{display:inline-flex;align-items:center;gap:4px;min-width:32px;justify-content:center}
  `}</style>
  <div className="crm-list-filters">
   <label>Buscar<div className="search-box small-search"><Search size={17}/><input aria-label="Buscar prospectos" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} placeholder="Negocio, correo, teléfono…"/></div></label>
   <label>Estado<select value={state} onChange={e=>{setState(e.target.value);setMunicipality("");setCity("");setPage(0)}}><option value="">Todos</option>{states.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
   <label>Municipio<select value={municipality} disabled={!state} onChange={e=>{setMunicipality(e.target.value);setCity("");setPage(0)}}><option value="">Todos</option>{municipalities.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
   <label>Localidad<select value={city} disabled={!municipality} onChange={e=>{setCity(e.target.value);setPage(0)}}><option value="">Todas</option>{localities.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
   <label>Sector<select value={category} onChange={e=>{setCategory(e.target.value);setPage(0)}}><option value="">Todos</option><option value="pilot_food">Restauración, cafeterías y heladerías</option>{data?.categories.map(c=><option key={c.category}>{c.category}</option>)}</select></label>
   <label>Correo<select value={coverage} onChange={e=>{setCoverage(e.target.value);setPage(0)}}><option value="">Todos</option><option value="available">Con correo publicado</option><option value="missing">Sin correo localizado</option><option value="web">Con fuente externa registrada</option></select></label>
   <label>Teléfono<select value={columnFilters.has_phone||""} onChange={e=>filterColumn("has_phone",e.target.value)}><option value="">Todos</option><option value="yes">Con teléfono</option><option value="no">Sin teléfono</option></select></label>
   <label>Web<select value={columnFilters.has_website||""} onChange={e=>filterColumn("has_website",e.target.value)}><option value="">Todas</option><option value="yes">Con web</option><option value="no">Sin web</option></select></label>
   <label>Estado comercial<select value={status} onChange={e=>{setStatus(e.target.value);setPage(0)}}><option value="">Todos</option>{Object.entries(stages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
   <label>Revisión<select value={review} onChange={e=>{setReview(e.target.value);setPage(0)}}><option value="">Todas</option>{Object.entries(reviewStages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
   <button type="button" className="button button-outline button-sm" onClick={clearFilters}><X size={15}/> Limpiar filtros</button>
  </div>
  <div className="crm-list-header">
   <span className="muted" aria-live="polite">{data?format(total):"—"} negocios · {data?format(data.count.with_email):"—"} con correo · {data?format(data.count.unique_emails):"—"} correos únicos{hasFilters?" · filtros activos":""}</span>
   <label className="crm-pagination-group">Resultados por página <select aria-label="Resultados por página" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(0);setJump("")}}>{[25,50,100,200].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
  </div>
  <div className="crm-table-shell" aria-busy={loading}>
   <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map(([key,label])=><th key={key} scope="col" aria-sort={sort===key?(direction==="asc"?"ascending":"descending"):"none"}>
    <button type="button" title={"Ordenar por "+label} onClick={()=>orderBy(key)}>{label}{sort===key?(direction==="asc"?<ArrowUp size={14}/>:<ArrowDown size={14}/>):<ArrowUpDown size={14} opacity={.5}/>}</button>
    {textColumns.has(key)&&<input className="crm-column-filter" aria-label={"Filtrar "+label} placeholder="Filtrar…" value={columnFilters["filter_"+key]||""} onChange={e=>filterColumn("filter_"+key,e.target.value)}/>}
    {key==="state"&&<select className="crm-column-filter" aria-label="Filtrar estado geográfico" value={state} onChange={e=>{setState(e.target.value);setMunicipality("");setCity("");setPage(0)}}><option value="">Todos</option>{states.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select>}
    {key==="municipality"&&<select className="crm-column-filter" aria-label="Filtrar municipio" value={municipality} disabled={!state} onChange={e=>{setMunicipality(e.target.value);setCity("");setPage(0)}}><option value="">Todos</option>{municipalities.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select>}
    {key==="city"&&<select className="crm-column-filter" aria-label="Filtrar localidad" value={city} disabled={!municipality} onChange={e=>{setCity(e.target.value);setPage(0)}}><option value="">Todas</option>{localities.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select>}
    {key==="category"&&<select className="crm-column-filter" aria-label="Filtrar sector" value={category} onChange={e=>{setCategory(e.target.value);setPage(0)}}><option value="">Todos</option><option value="pilot_food">Restauración y heladerías</option>{data?.categories.map(c=><option key={c.category}>{c.category}</option>)}</select>}
    {key==="status"&&<select className="crm-column-filter" aria-label="Filtrar estado comercial" value={status} onChange={e=>{setStatus(e.target.value);setPage(0)}}><option value="">Todos</option>{Object.entries(stages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select>}
    {key==="review"&&<select className="crm-column-filter" aria-label="Filtrar revisión" value={review} onChange={e=>{setReview(e.target.value);setPage(0)}}><option value="">Todas</option>{Object.entries(reviewStages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select>}
   </th>)}<th scope="col">Ficha</th></tr></thead>
   <tbody style={{opacity:loading?0.45:1}}>{data?.prospects.map(p=><tr key={p.id}>
    <td><strong>{p.name}</strong></td><td>{p.state}</td><td>{p.municipality}</td><td>{p.city}</td><td>{p.category}</td><td>{p.activity||"—"}</td>
    <td>{p.public_email||p.email||"Sin correo"}{p.public_email&&<small>Fuente externa</small>}</td><td>{p.phone||"—"}</td><td>{p.address||"—"}</td><td>{p.website||"—"}</td><td>{stages[p.status]||p.status}</td><td>{reviewStages[p.contact_review]||p.contact_review||"—"}</td>
    <td><button type="button" className="inline-table-button" disabled={loading} onClick={()=>setFocus({...p})}>Abrir</button></td>
   </tr>)}</tbody></table></div>
   {loading&&<div className="crm-table-loading" role="status"><span><Loader2 className="crm-list-spinner" size={20}/>{data?"Actualizando resultados…":"Cargando negocios…"}</span></div>}
   {!loading&&data&&!data.prospects.length&&<p className="muted" role="status">No hay prospectos con estos filtros. {hasFilters&&<button type="button" className="inline-table-button" onClick={clearFilters}>Limpiar filtros</button>}</p>}
  </div>
  <div className="crm-pagination">
   <span className="muted">{total?format(shownPage*shownSize+1)+"–"+format(Math.min(total,(shownPage+1)*shownSize)):"0"} de {format(total)} resultados</span>
   <div className="crm-pagination-group">
    <button type="button" className="button button-outline button-sm" aria-label="Primera página" title="Primera página" disabled={loading||page===0} onClick={()=>goPage(0)}><ChevronsLeft size={16}/></button>
    <button type="button" className="button button-outline button-sm" aria-label="Página anterior" disabled={loading||page===0} onClick={()=>goPage(page-1)}><ChevronLeft size={16}/></button>
    <span>Página {format(shownPage+1)} de {format(totalPages)}</span>
    <button type="button" className="button button-outline button-sm" aria-label="Página siguiente" disabled={loading||page>=totalPages-1} onClick={()=>goPage(page+1)}><ChevronRight size={16}/></button>
    <button type="button" className="button button-outline button-sm" aria-label="Última página" title="Última página" disabled={loading||page>=totalPages-1} onClick={()=>goPage(totalPages-1)}><ChevronsRight size={16}/></button>
   </div>
   <form className="crm-pagination-group" onSubmit={e=>{e.preventDefault();const n=Number(jump);if(Number.isInteger(n)&&n>=1&&n<=totalPages)goPage(n-1);}}>
    <label htmlFor="crm-page-jump">Ir a página</label><input id="crm-page-jump" type="number" min={1} max={totalPages} value={jump} onChange={e=>setJump(e.target.value)} disabled={loading||totalPages===1} placeholder={String(shownPage+1)}/>
    <button type="submit" className="button button-outline button-sm" disabled={loading||!jump||Number(jump)<1||Number(jump)>totalPages}>Ir</button>
   </form>
  </div>
  {focus&&<div className="admin-inspector"><div className="inspector-head"><div><strong>{focus.name}</strong><small>{focus.email} · {focus.activity}</small></div><button className="inline-table-button" onClick={()=>setFocus(null)}>Cerrar</button></div><div className="form-stack">
   <label>Estado<select disabled={focus.status==="do_not_contact"} value={focus.status} onChange={e=>setFocus({...focus,status:e.target.value})}>{Object.entries(stages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
   <p>{focus.address||focus.city}</p>{(focus.latitude||focus.longitude)&&<p>Coordenadas: {focus.latitude||"—"}, {focus.longitude||"—"}</p>}<p>Teléfono: {focus.phone||"Sin localizar"} · Correo: {focus.public_email||focus.email||"Sin localizar"}</p>{focus.website&&<p>Web: {focus.website}</p>}
   <details><summary>Datos de contacto y fuente</summary><label>Correo comercial publicado en otra fuente<input type="email" value={focus.public_email||""} onChange={e=>setFocus({...focus,public_email:e.target.value})} disabled={busy||focus.status==="do_not_contact"}/></label>
   <label>URL de la fuente pública<input type="url" value={focus.public_email_source||""} onChange={e=>setFocus({...focus,public_email_source:e.target.value})} disabled={busy||focus.status==="do_not_contact"}/></label>
   {focus.public_email_checked_at&&<small>Fuente registrada: {new Date(focus.public_email_checked_at).toLocaleDateString("es-MX")}</small>}
   <p className="muted">La presencia de un correo publicado no confirma vigencia, entregabilidad ni permiso de envío.</p>
   <label>Resultado de revisión<select value={focus.contact_review} onChange={e=>setFocus({...focus,contact_review:e.target.value})}>{Object.entries(reviewStages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
   <label>Fuente revisada (URL)<input type="url" value={focus.contact_review_url||""} onChange={e=>setFocus({...focus,contact_review_url:e.target.value})}/></label>
   {focus.contact_reviewed_at&&<small>Última revisión: {new Date(focus.contact_reviewed_at).toLocaleDateString("es-MX")}</small>}
   </details>
   <label>Notas<textarea maxLength={2000} value={focus.notes} onChange={e=>setFocus({...focus,notes:e.target.value})}/></label>
   <button className="button button-dark button-sm" disabled={busy} onClick={save}>Guardar ficha</button>
  </div></div>}
 </div>;
}
