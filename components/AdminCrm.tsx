"use client";
import {useEffect,useRef,useState} from "react";
import {Upload,Search,Loader2,ArrowUp,ArrowDown,ArrowUpDown,ChevronLeft,ChevronRight,ChevronsLeft,ChevronsRight,X,Building2,Mail,FolderUp,CheckCircle2,RefreshCw} from "lucide-react";
import {AdminCrmCsvLibrary} from "./AdminCrmCsvLibrary";
import {CrmContactHistory,CrmMailSettings,useCrmMailSync} from "./CrmContactHistory";
type Prospect={id:string;name:string;phone:string;address:string;website:string;latitude:string;longitude:string;email:string|null;public_email:string|null;public_email_source:string|null;public_email_checked_at:string|null;contact_review:string;contact_review_url:string|null;contact_reviewed_at:string|null;state:string;municipality:string;city:string;category:string;activity:string;status:string;notes:string;last_sent_at?:string|null;last_attempt_at?:string|null;last_received_at?:string|null;sent_count?:number};
type Region={country_code:string;state_code:string;state:string;municipality_code:string;municipality:string;locality_code:string;city:string;total:number};
type Count={total:number;relevant:number;withEmail:number;missingOrInvalidEmail:number;uniqueEmails:number};
type Report=Count&{duplicates:number;skipped:number;byCity:Array<Count&{state:string;municipality:string;city:string;state_code:string;municipality_code:string;locality_code:string}>;bySector:Array<Count&{category:string}>};
type Data={prospects:Prospect[];count:{total:number;unique_emails:number;with_email:number;missing_email:number;reviewed:number};regions:Region[];categories:Array<{category:string;total:number}>;imports:Array<{filename:string;created_at:string;report:Report&{edition?:string|null}}>;page:number;pageSize:number;totalPages:number};
const stages:Record<string,string>={pending_review:"Sin contactar",qualified:"Sin contactar (revisado)",contacted:"Contactado",interested:"Interesado",trial:"En prueba",converted:"Cliente",discarded:"No interesado",do_not_contact:"No contactar"};
const reviewStages:Record<string,string>={pending:"Pendiente",source_found:"Fuente localizada",no_contact_found:"Sin contacto localizado",ambiguous:"Identidad dudosa",not_relevant:"No relevante"};
export function AdminCrm(){
 const [data,setData]=useState<Data|null>(null);
 const [tab,setTab]=useState<"directory"|"mail"|"imports">("directory");
 const [options,setOptions]=useState<{regions:Region[];categories:Data["categories"]}>({regions:[],categories:[]});
 const [optionsError,setOptionsError]=useState("");
 const [optionsLoading,setOptionsLoading]=useState(true);


 const [review,setReview]=useState(""),[coverage,setCoverage]=useState(""),[country,setCountry]=useState("MX"),[state,setState]=useState(""),[municipality,setMunicipality]=useState(""),[city,setCity]=useState(""),[category,setCategory]=useState(""),[status,setStatus]=useState(""),[search,setSearch]=useState(""),[page,setPage]=useState(0);
 const [pageSize,setPageSize]=useState(50),[sort,setSort]=useState("name"),[direction,setDirection]=useState<"asc"|"desc">("asc");
 const [columnFilters,setColumnFilters]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[jump,setJump]=useState("");
 const requestVersion=useRef(0),lastRevision=useRef(-1),lastText=useRef("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[revision,setRevision]=useState(0),[focus,setFocus]=useState<Prospect|null>(null);
 const mailSync=useCrmMailSync(()=>setRevision(v=>v+1));
 useEffect(()=>{
  const controller=new AbortController();setOptionsLoading(true);
  fetch("/api/local/admin/crm?view=options",{signal:controller.signal,cache:"no-store"}).then(async r=>{
   const j=await r.json();if(!r.ok)throw new Error(j.error||"No se pudieron cargar los filtros.");
   if(!controller.signal.aborted){setOptions(j);setOptionsError("");}
  }).catch(e=>{if(!controller.signal.aborted)setOptionsError(e.message);}).finally(()=>{if(!controller.signal.aborted)setOptionsLoading(false);});
  return()=>controller.abort();
 },[revision]);
 useEffect(()=>{
  if(tab!=="directory")return;
  const controller=new AbortController(),version=++requestVersion.current;
  setLoading(true);setError("");
  const refresh=lastRevision.current!==revision;
  const textKey=JSON.stringify([search,columnFilters]);
  const delay=lastText.current!==textKey&&lastRevision.current!==-1?160:0;lastText.current=textKey;
  const params=new URLSearchParams({compact:"1",...(refresh?{refresh:"1"}:{}),country_code:country,state_code:state,municipality_code:municipality,locality_code:city,category,status,coverage,review,q:search,page:String(page),page_size:String(pageSize),sort,direction,...columnFilters});
  // Coalesce rapid typing/filter changes and cancel outdated requests.
  const timer=setTimeout(()=>{
   fetch("/api/local/admin/crm?"+params,{signal:controller.signal,cache:"no-store"}).then(async r=>{
    const j=await r.json();if(!r.ok)throw new Error(j.error||"No se pudo cargar el listado.");
    if(controller.signal.aborted||version!==requestVersion.current)return;
    lastRevision.current=revision;setData(j);if(j.page!==page)setPage(j.page);
   }).catch(e=>{if(!controller.signal.aborted&&version===requestVersion.current)setError(e.message);})
   .finally(()=>{if(!controller.signal.aborted&&version===requestVersion.current)setLoading(false);});
  },delay);
  return()=>{clearTimeout(timer);controller.abort();};
 },[country,state,municipality,city,category,status,coverage,review,search,page,pageSize,sort,direction,columnFilters,revision,tab]);
 useEffect(()=>{if(!focus)return;const handler=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!busy)setFocus(null);};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[focus,busy]);
 const regions=options.regions,states=[...new Map(regions.filter(r=>!country||r.country_code===country).map(r=>[r.state_code,r.state])).entries()];
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
 return <div className="panel-card crm-workspace">
  <div className="crm-hero"><div><span className="crm-eyebrow">GESTIÓN COMERCIAL</span><h2>CRM comercial</h2><p>Organiza tus negocios, contactos y conversaciones en un solo lugar.</p></div>{tab==="directory"&&<button type="button" className="button button-outline button-sm" onClick={()=>{setRevision(v=>v+1);}} disabled={loading}><RefreshCw size={15}/> Actualizar negocios</button>}</div>
  <div className="crm-tabs" role="tablist" aria-label="Secciones del CRM">
   {([{id:"directory",label:"Negocios",icon:Building2},{id:"mail",label:"Sincronización de correo",icon:Mail},{id:"imports",label:"Importaciones",icon:FolderUp}] as const).map(t=><button key={t.id} type="button" role="tab" aria-selected={tab===t.id} className={tab===t.id?"active":""} onClick={()=>setTab(t.id)}><t.icon size={18}/>{t.label}</button>)}
  </div>
  {tab==="directory"&&<>{error&&<div role="alert" className="alert error">{error}</div>}{notice&&<div role="status" className="alert success">{notice}</div>}{optionsError&&<div role="alert" className="alert error">{optionsError}</div>}
  <div className="crm-metrics" aria-label="Resumen de los resultados filtrados">
   {([{label:"Negocios",n:data?.count.total,icon:Building2},{label:"Con correo",n:data?.count.with_email,icon:Mail},{label:"Correos únicos",n:data?.count.unique_emails,icon:Mail},{label:"Revisados",n:data?.count.reviewed,icon:CheckCircle2}] as const).map(m=><div className="crm-metric" key={m.label}><span><m.icon size={16}/>{m.label}</span><strong>{m.n===undefined?"—":format(m.n)}</strong></div>)}
  </div></>}
  {tab==="mail"&&<CrmMailSettings sync={mailSync}/>}
  {tab==="imports"&&<section className="crm-imports"><h3>Actualización de contactos</h3><p className="muted">Archivos nuevos o modificados pendientes de incorporar a PostgreSQL.</p>{pendingCities.length>0&&options.regions.length>0&&<div className="admin-inspector"><div className="content-heading"><strong>Carga inicial de negocios</strong></div>{pendingCities.map(x=><button key={x.code} type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>void importOfficial(x.code,x.name)}><Upload size={16}/> Cargar {x.name}</button>)}</div>}{error&&<div role="alert" className="alert error">{error}</div>}{notice&&<div role="status" className="alert success">{notice}</div>}<AdminCrmCsvLibrary onSaved={()=>{setPage(0);setRevision(x=>x+1);}}/></section>}
  <style>{`
   .crm-workspace{min-width:0}
   .crm-hero{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:4px 0 16px}
   .crm-hero h2{margin:4px 0;font-size:1.65rem;letter-spacing:-.035em}
   .crm-hero p{margin:4px 0;color:var(--muted,#64748b);font-size:.9rem}
   .crm-eyebrow{font-size:.68rem;font-weight:700;letter-spacing:.13em;color:var(--muted,#64748b)}
   .crm-tabs{display:flex;gap:6px;overflow-x:auto;border-bottom:1px solid var(--border,#e2e8f0);margin-bottom:20px}
   .crm-tabs button{display:flex;align-items:center;gap:8px;white-space:nowrap;padding:12px 14px;border:0;border-bottom:2px solid transparent;background:transparent;color:inherit;cursor:pointer;font:inherit;font-weight:600;font-size:.86rem;opacity:.72}
   .crm-tabs button.active{border-bottom-color:currentColor;opacity:1}
   .crm-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 20px}
   .crm-metric{border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:14px;min-width:0;background:var(--card,#fff)}
   .crm-metric span{display:flex;align-items:center;gap:7px;font-size:.78rem;color:var(--muted,#64748b)}
   .crm-metric strong{display:block;font-size:1.55rem;letter-spacing:-.04em;font-variant-numeric:tabular-nums;margin-top:8px}
   .crm-filter-box{container-type:inline-size;min-width:0;max-width:100%;background:var(--color-brand-100,#f8eef1);border:1px solid var(--color-bg-2,#e8dce1);border-radius:16px;padding:16px 18px;margin:16px 0 18px}
   .crm-filter-heading{display:flex;align-items:center;justify-content:space-between;gap:8px 16px;flex-wrap:wrap;color:var(--color-brand-900,#57233d);font-size:.85rem;font-weight:700}
   .crm-filter-heading>div{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}
   .crm-filter-heading .crm-filter-state{font-size:.75rem;font-weight:600;opacity:.8}
   .crm-filter-heading .button{height:34px;min-height:34px;padding:0 12px;border-radius:8px;font-size:.75rem;gap:6px;flex-shrink:0;transform:none}
   .crm-workspace .crm-list-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 14px;align-items:start;padding:0;margin:0}
   .crm-workspace .crm-filter-search{margin:14px 0 16px}
   .crm-workspace .crm-filter-field{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:18px 42px;gap:6px;min-width:0;max-width:100%;margin:0;font-size:.8rem;font-weight:700;color:var(--color-brand-900,#57233d);line-height:18px}
   .crm-workspace .crm-filter-field>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
   .crm-workspace .crm-filter-field select,.crm-workspace .crm-filter-input{display:block;background:#fff;border:1px solid #d8c6cf;border-radius:9px;height:42px;min-height:42px;max-height:42px;width:100%;min-width:0;max-width:100%;margin:0;padding:0 10px;font-size:.82rem;font-weight:500;line-height:normal;color:#38232e;box-shadow:none}
   .crm-workspace .crm-filter-field select{padding-right:26px;text-overflow:ellipsis}
   .crm-workspace .crm-filter-field select:disabled{opacity:.55;background:#f6f2f4;cursor:not-allowed}
   .crm-workspace .crm-filter-search-control{position:relative;display:flex;align-items:center;min-width:0;width:100%}
   .crm-workspace .crm-filter-search-control svg{position:absolute;left:12px;pointer-events:none;color:var(--color-brand,#783752)}
   .crm-workspace .crm-filter-search-control .crm-filter-input{padding-left:38px}
   .crm-workspace .crm-filter-field select:focus,.crm-workspace .crm-filter-input:focus,.crm-workspace .crm-column-filter:focus{outline:2px solid var(--color-brand-300,#ba849c);outline-offset:1px}
   @container (max-width:620px){.crm-workspace .crm-list-filters{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}
   @container (max-width:340px){.crm-workspace .crm-list-filters{grid-template-columns:minmax(0,1fr)}}
   .crm-workspace .crm-table-shell .data-table thead th{background:var(--color-brand-900,#57233d);color:#fff;border-color:#ffffff20;vertical-align:top}
   .crm-workspace .crm-table-shell .data-table thead th[aria-sort="ascending"],.crm-workspace .crm-table-shell .data-table thead th[aria-sort="descending"]{background:var(--color-brand,#783752)}
   .crm-workspace .crm-table-shell .data-table thead th button{color:#fff}
   .crm-workspace .crm-table-shell .crm-column-filter{background:#fff;color:#38232e;border-color:#ffffff55;border-radius:7px;min-height:29px}
   .crm-workspace .crm-table-shell tbody tr:nth-child(even){background:#faf7f8}
   .crm-workspace .crm-table-shell tbody tr:hover{background:var(--color-brand-100,#f8eef1)}
   .crm-activity{display:grid;gap:5px;min-width:145px;font-size:.77rem}
   .crm-activity strong{color:var(--color-brand-900,#57233d)}
   .crm-activity .crm-inbound{color:#166534;font-weight:700}
   .crm-sync-panel{border:1px solid var(--line,#ddd);border-radius:14px;padding:20px}
   .crm-sync-status{display:grid;gap:8px;background:var(--color-brand-100,#f8eef1);padding:16px;border-radius:10px;margin:12px 0}
   .crm-sync-status>div{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;font-size:.82rem}
   .crm-contact-history{border-top:1px solid var(--line,#ddd);padding-top:16px;margin-top:12px}
   .crm-contact-history h3{display:flex;align-items:center;gap:8px;letter-spacing:-.025em}
   .crm-history-item{border:1px solid var(--line,#ddd);border-radius:10px;margin:8px 0;padding:10px;background:#fff}
   .crm-history-item summary{display:flex;align-items:flex-start;gap:10px;cursor:pointer;list-style:none}
   .crm-history-item summary span:last-child{display:grid;gap:4px;min-width:0;overflow-wrap:anywhere}
   .crm-history-item small{font-size:.73rem;color:var(--muted,#64748b)}
   .crm-history-item p{margin:12px 0 0;font-size:.85rem}
   .crm-history-icon{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;flex-shrink:0;background:var(--color-brand-100,#f8eef1);color:var(--color-brand-900,#57233d)}
   .crm-history-icon.inbound{background:#e7f4e9;color:#166534}
   @media(max-width:700px){.crm-filter-box{padding:12px}}
   .crm-workspace .crm-table-shell{border:1px solid var(--border,#e2e8f0);border-radius:12px;overflow:hidden}
   .crm-workspace .crm-table-shell td{padding:12px 10px;font-size:.82rem}
   .crm-workspace .crm-table-shell tbody tr:hover{background:rgba(125,125,125,.07)}
   .crm-workspace .crm-table-shell th{padding:12px 10px}
   .crm-stage{display:inline-block;border:1px solid var(--border,#d5d5d5);border-radius:999px;padding:4px 8px;white-space:nowrap;font-size:.73rem;font-weight:600}
   .crm-stage[data-stage="interested"],.crm-stage[data-stage="converted"]{color:#15803d;background:rgba(22,163,74,.08)}
   .crm-stage[data-stage="do_not_contact"],.crm-stage[data-stage="discarded"]{color:#b91c1c;background:rgba(220,38,38,.08)}
   .crm-inspector-wrap{position:fixed;inset:0;z-index:70;background:#0005;display:flex;justify-content:flex-end}
   .crm-inspector-wrap .admin-inspector{background:var(--card,#fff);width:min(100%,520px);height:100%;margin:0;border-radius:0;padding:24px;overflow:auto;box-shadow:-12px 0 30px #0002}
   @media(max-width:700px){.crm-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.crm-metric{padding:12px}.crm-metric strong{font-size:1.3rem}.crm-hero h2{font-size:1.35rem}.crm-tabs button{padding:10px}}
   @keyframes crm-list-spin{to{transform:rotate(360deg)}}
   .crm-list-spinner{animation:crm-list-spin .8s linear infinite;flex-shrink:0}
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
  {tab==="directory"&&<>{optionsLoading&&<small role="status" className="muted">Cargando opciones de filtros…</small>}<div className="crm-filter-box"><div className="crm-filter-heading"><div><strong>Filtrar negocios</strong><span className="crm-filter-state">{hasFilters?"Filtros activos":"Todos los negocios"}</span></div><button type="button" className="button button-outline button-sm" onClick={clearFilters}><X size={15}/> Limpiar filtros</button></div><div className="crm-filter-search"><label className="crm-filter-field"><span>Buscar</span><span className="crm-filter-search-control"><Search size={17}/><input className="crm-filter-input" aria-label="Buscar prospectos" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} placeholder="Negocio, correo, teléfono…"/></span></label></div><div className="crm-list-filters">
   <label className="crm-filter-field"><span>Estado</span><select value={state} onChange={e=>{setState(e.target.value);setMunicipality("");setCity("");setPage(0)}}><option value="">Todos</option>{states.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
   <label className="crm-filter-field"><span>Municipio</span><select value={municipality} disabled={!state} onChange={e=>{setMunicipality(e.target.value);setCity("");setPage(0)}}><option value="">Todos</option>{municipalities.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
   <label className="crm-filter-field"><span>Localidad</span><select value={city} disabled={!municipality} onChange={e=>{setCity(e.target.value);setPage(0)}}><option value="">Todas</option>{localities.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
   <label className="crm-filter-field"><span>Sector</span><select value={category} onChange={e=>{setCategory(e.target.value);setPage(0)}}><option value="">Todos</option><option value="pilot_food">Restauración, cafeterías y heladerías</option>{options.categories.map(c=><option key={c.category}>{c.category}</option>)}</select></label>
   <label className="crm-filter-field"><span>Correo</span><select value={coverage} onChange={e=>{setCoverage(e.target.value);setPage(0)}}><option value="">Todos</option><option value="available">Con correo publicado</option><option value="missing">Sin correo localizado</option><option value="web">Con fuente externa registrada</option></select></label>
   <label className="crm-filter-field"><span>Teléfono</span><select value={columnFilters.has_phone||""} onChange={e=>filterColumn("has_phone",e.target.value)}><option value="">Todos</option><option value="yes">Con teléfono</option><option value="no">Sin teléfono</option></select></label>
   <label className="crm-filter-field"><span>Web</span><select value={columnFilters.has_website||""} onChange={e=>filterColumn("has_website",e.target.value)}><option value="">Todas</option><option value="yes">Con web</option><option value="no">Sin web</option></select></label>
   <label className="crm-filter-field"><span>Estado comercial</span><select value={status} onChange={e=>{setStatus(e.target.value);setPage(0)}}><option value="">Todos</option>{Object.entries(stages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
   <label className="crm-filter-field"><span>Revisión</span><select value={review} onChange={e=>{setReview(e.target.value);setPage(0)}}><option value="">Todas</option>{Object.entries(reviewStages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
  </div></div>
  <div className="crm-list-header">
   <span className="muted" aria-live="polite">{data?format(total):"—"} negocios · {data?format(data.count.with_email):"—"} con correo · {data?format(data.count.unique_emails):"—"} correos únicos{hasFilters?" · filtros activos":""}</span>
   
  </div>
  <div className="crm-table-shell" aria-busy={loading}>
   <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map(([key,label])=><th key={key} scope="col" aria-sort={sort===key?(direction==="asc"?"ascending":"descending"):"none"}>
    <button type="button" title={"Ordenar por "+label} onClick={()=>orderBy(key)}>{label}{sort===key?(direction==="asc"?<ArrowUp size={14}/>:<ArrowDown size={14}/>):<ArrowUpDown size={14} opacity={.5}/>}</button>
    {textColumns.has(key)&&<input className="crm-column-filter" aria-label={"Filtrar "+label} placeholder="Filtrar…" value={columnFilters["filter_"+key]||""} onChange={e=>filterColumn("filter_"+key,e.target.value)}/>}
    {key==="state"&&<select className="crm-column-filter" aria-label="Filtrar estado geográfico" value={state} onChange={e=>{setState(e.target.value);setMunicipality("");setCity("");setPage(0)}}><option value="">Todos</option>{states.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select>}
    {key==="municipality"&&<select className="crm-column-filter" aria-label="Filtrar municipio" value={municipality} disabled={!state} onChange={e=>{setMunicipality(e.target.value);setCity("");setPage(0)}}><option value="">Todos</option>{municipalities.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select>}
    {key==="city"&&<select className="crm-column-filter" aria-label="Filtrar localidad" value={city} disabled={!municipality} onChange={e=>{setCity(e.target.value);setPage(0)}}><option value="">Todas</option>{localities.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select>}
    {key==="category"&&<select className="crm-column-filter" aria-label="Filtrar sector" value={category} onChange={e=>{setCategory(e.target.value);setPage(0)}}><option value="">Todos</option><option value="pilot_food">Restauración y heladerías</option>{options.categories.map(c=><option key={c.category}>{c.category}</option>)}</select>}
    {key==="status"&&<select className="crm-column-filter" aria-label="Filtrar estado comercial" value={status} onChange={e=>{setStatus(e.target.value);setPage(0)}}><option value="">Todos</option>{Object.entries(stages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select>}
    {key==="review"&&<select className="crm-column-filter" aria-label="Filtrar revisión" value={review} onChange={e=>{setReview(e.target.value);setPage(0)}}><option value="">Todas</option>{Object.entries(reviewStages).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select>}
   </th>)}<th scope="col">Actividad de correo</th><th scope="col">Ficha</th></tr></thead>
   <tbody style={{opacity:loading?0.45:1}}>{data?.prospects.map(p=><tr key={p.id}>
    <td><strong>{p.name}</strong></td><td>{p.state}</td><td>{p.municipality}</td><td>{p.city}</td><td>{p.category}</td><td>{p.activity||"—"}</td>
    <td>{p.public_email||p.email||"Sin correo"}{p.public_email&&<small>Fuente externa</small>}</td><td>{p.phone||"—"}</td><td>{p.address||"—"}</td><td>{p.website||"—"}</td><td><span className="crm-stage" data-stage={p.status}>{stages[p.status]||p.status}</span></td><td>{reviewStages[p.contact_review]||p.contact_review||"—"}</td>
    <td><div className="crm-activity">{p.last_sent_at?<><strong>{p.sent_count||0} enviado(s)</strong><small>Último: {new Date(p.last_sent_at).toLocaleDateString("es-MX")}</small></>:p.last_attempt_at?<small>Intento de envío: {new Date(p.last_attempt_at).toLocaleDateString("es-MX")}</small>:<small>Sin envíos registrados</small>}{p.last_received_at&&<small className="crm-inbound">Recibido: {new Date(p.last_received_at).toLocaleDateString("es-MX")}</small>}</div></td>
    <td><button type="button" className="inline-table-button" disabled={loading} onClick={()=>setFocus({...p})}>Abrir</button></td>
   </tr>)}</tbody></table></div>
   {loading&&<div className="crm-table-loading" role="status"><span><Loader2 className="crm-list-spinner" size={20}/>{data?"Actualizando resultados…":"Cargando negocios…"}</span></div>}
   {!loading&&data&&!data.prospects.length&&<p className="muted" role="status">No hay prospectos con estos filtros. {hasFilters&&<button type="button" className="inline-table-button" onClick={clearFilters}>Limpiar filtros</button>}</p>}
  </div>
  <div className="crm-pagination">
   <label className="crm-pagination-group">Resultados por página <select aria-label="Resultados por página" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(0);setJump("")}}>{[25,50,100,200].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
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
  {focus&&<div className="crm-inspector-wrap" onClick={e=>{if(e.target===e.currentTarget&&!busy)setFocus(null);}}><div className="admin-inspector" role="dialog" aria-modal="true" aria-label="Ficha del negocio"><div className="inspector-head"><div><strong>{focus.name}</strong><small>{focus.email} · {focus.activity}</small></div><button className="inline-table-button" onClick={()=>setFocus(null)}>Cerrar</button></div><div className="form-stack">
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
   <CrmContactHistory id={focus.id} revision={revision}/>
  </div></div></div>}
 </>}
 </div>;
}
