"use client";
import {useEffect,useState} from "react";
import {Activity,ArrowUpRight,Check,ChevronDown,FileText,Mail,Plus,Search,Shield,Store,Users} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {db} from "@/lib/supabase";
import {dateShort} from "@/lib/format";
type Biz={id:string;name:string;slug:string;category:string|null;active:boolean;public_listing:boolean;created_at:string};
type Person={user_id:string;full_name:string;email:string;businesses:number;joined_at:string};
function AdminContent({account}:{account:Account}){
 const [tab,setTab]=useState<"business"|"users"|"campaigns">("business"),[businesses,setBusinesses]=useState<Biz[]>([]),[users,setUsers]=useState<Person[]>([]),[transactionCount,setTransactionCount]=useState(0),[membershipCount,setMembershipCount]=useState(0),[search,setSearch]=useState("");
 const [focusBiz,setFocusBiz]=useState<Biz|null>(null),[focusCustomers,setFocusCustomers]=useState(0),[focusStaff,setFocusStaff]=useState(0),[focusTx,setFocusTx]=useState(0),[focusLocations,setFocusLocations]=useState(0),[focusProgram,setFocusProgram]=useState("");
 const [focusUser,setFocusUser]=useState<Person|null>(null),[focusCards,setFocusCards]=useState<{business_id:string;balance:number;businesses:{name:string;slug:string}|null}[]>([]);
 const [name,setName]=useState(""),[slug,setSlug]=useState(""),[manager,setManager]=useState(""),[subject,setSubject]=useState(""),[body,setBody]=useState(""),[drafts,setDrafts]=useState<{id:string;subject:string;created_at:string}[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 async function load(){const [b,u,t,m,c]=await Promise.all([
  db().from("businesses").select("id,name,slug,category,active,public_listing,created_at").order("created_at",{ascending:false}),
  db().rpc("admin_user_directory"),
  db().from("loyalty_transactions").select("id",{head:true,count:"exact"}),
  db().from("loyalty_memberships").select("id",{head:true,count:"exact"}),
  db().from("marketing_campaigns").select("id,subject,created_at").is("business_id",null).order("created_at",{ascending:false})
 ]);
 setBusinesses((b.data||[]) as Biz[]);setUsers((u.data||[]) as Person[]);setTransactionCount(t.count||0);setMembershipCount(m.count||0);setDrafts(c.data||[]);
 if(b.error||u.error)setError(b.error?.message||u.error?.message||"Error cargando datos");
 }
 useEffect(()=>{load()},[]);
 function slugify(v:string){return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
 async function createBusiness(e:React.FormEvent){e.preventDefault();setError("");setSuccess("");setBusy(true);
 const {error}=await db().rpc("admin_create_business",{p_name:name,p_slug:slug,p_manager_email:manager});
 setBusy(false);if(error){setError(error.message);return}
 setSuccess("Negocio creado. El responsable podrá reclamar su invitación al verificar su email e iniciar sesión.");
 setName("");setSlug("");setManager("");await load()
 }
 async function saveDraft(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setSuccess("");
 const {error}=await db().from("marketing_campaigns").insert({business_id:null,created_by:account.user.id,subject,body_text:body,status:"draft"});
 setBusy(false);if(error){setError(error.message);return}
 setSubject("");setBody("");setSuccess("Borrador guardado. No se ha enviado ningún correo.");await load()
 }
 async function inspectBusiness(b:Biz){setFocusBiz(b);setError("");
  const [c,s,t,l,p]=await Promise.all([
   db().rpc("business_customer_directory",{p_business:b.id}),
   db().rpc("business_staff_directory",{p_business:b.id}),
   db().from("loyalty_transactions").select("id",{count:"exact",head:true}).eq("business_id",b.id),
   db().from("business_locations").select("id",{count:"exact",head:true}).eq("business_id",b.id),
   db().from("loyalty_programs").select("type").eq("business_id",b.id).maybeSingle()
  ]);
  setFocusCustomers(c.data?.length||0);setFocusStaff(s.data?.length||0);setFocusTx(t.count||0);setFocusLocations(l.count||0);setFocusProgram(p.data?.type||"—");
 }
 async function inspectUser(u:Person){setFocusUser(u);setError("");
  const {data,error}=await db().from("loyalty_memberships").select("business_id,balance,businesses(name,slug)").eq("customer_id",u.user_id);
  if(error){setError(error.message);return}
  setFocusCards((data||[]) as unknown as {business_id:string;balance:number;businesses:{name:string;slug:string}|null}[]);
 }
 async function changeActive(){if(!focusBiz)return;
  if(!window.confirm(focusBiz.active?"¿Suspender este negocio? Los empleados no podrán registrar compras.":"¿Reactivar este negocio?"))return;
  setBusy(true);const {error}=await db().from("businesses").update({active:!focusBiz.active}).eq("id",focusBiz.id);
  setBusy(false);if(error){setError(error.message);return}
  setSuccess("Estado del negocio actualizado.");await inspectBusiness({...focusBiz,active:!focusBiz.active});await load();
 }
 const list=businesses.filter(b=>(b.name+" "+b.slug).toLowerCase().includes(search.toLowerCase()));
 return <><div className="kpi-grid"><div className="kpi-card"><div className="kpi-symbol green"><Store/></div><span>Negocios registrados</span><strong>{businesses.length}</strong><small>{businesses.filter(b=>b.active).length} activos</small></div><div className="kpi-card"><div className="kpi-symbol peach"><Users/></div><span>Usuarios</span><strong>{users.length}</strong><small>Cuentas de la plataforma</small></div><div className="kpi-card"><div className="kpi-symbol purple"><Activity/></div><span>Tarjetas creadas</span><strong>{membershipCount}</strong><small>En todos los negocios</small></div><div className="kpi-card"><div className="kpi-symbol pink"><Shield/></div><span>Operaciones registradas</span><strong>{transactionCount}</strong><small>Historial global</small></div></div>
 <div className="tab-bar"><button className={tab==="business"?"active":""} onClick={()=>setTab("business")}><Store size={17}/> Negocios</button><button className={tab==="users"?"active":""} onClick={()=>setTab("users")}><Users size={17}/> Usuarios</button><button className={tab==="campaigns"?"active":""} onClick={()=>setTab("campaigns")}><Mail size={17}/> Marketing de plataforma</button></div>
 {error&&<div className="alert error">{error}</div>}{success&&<div className="alert success"><Check size={17}/>{success}</div>}
 {tab==="business"&&<div className="admin-grid"><div className="panel-card"><div className="content-heading"><div><h2>Red de negocios</h2><p>Todos los negocios del ecosistema.</p></div></div><div className="search-box small-search"><Search size={17}/><input placeholder="Buscar negocio..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Negocio</th><th>Estado</th><th>Directorio</th><th>Fecha</th><th></th></tr></thead><tbody>{list.map(b=><tr key={b.id}><td><strong>{b.name}</strong><small>/{b.slug}</small></td><td><span className={"table-pill "+(b.active?"":"inactive")}>{b.active?"Activo":"Inactivo"}</span></td><td>{b.public_listing?"Visible":"Oculto"}</td><td>{dateShort(b.created_at)}</td><td><button className="inline-table-button" onClick={()=>inspectBusiness(b)}>Detalles</button></td></tr>)}</tbody></table></div>{!list.length&&<p className="muted">No hay negocios con ese filtro.</p>}
 {focusBiz&&<div className="admin-inspector"><div className="inspector-head"><div><strong>{focusBiz.name}</strong><small>/{focusBiz.slug}</small></div><button onClick={()=>setFocusBiz(null)} className="inline-table-button">Cerrar</button></div><div className="inspector-stats"><div><strong>{focusCustomers}</strong><span>Clientes</span></div><div><strong>{focusStaff}</strong><span>Equipo</span></div><div><strong>{focusTx}</strong><span>Operaciones</span></div><div><strong>{focusLocations}</strong><span>Locales</span></div></div><p className="muted">Programa: <strong>{focusProgram}</strong> · Directorio: {focusBiz.public_listing?"Visible":"Oculto"}</p><button className={"button "+(focusBiz.active?"button-danger":"button-dark")+" button-sm"} disabled={busy} onClick={changeActive}>{focusBiz.active?"Suspender negocio":"Reactivar negocio"}</button></div>}
 </div>
 <form className="panel-card" onSubmit={createBusiness}><div className="panel-icon"><Plus size={22}/></div><h2>Dar de alta un negocio</h2><p className="muted">Solo un superadministrador puede crear negocios. El responsable recibe una invitación interna pendiente de reclamar.</p><div className="form-stack"><label>Nombre del negocio<input required minLength={2} value={name} placeholder="Ej. Café Noma" onChange={e=>{setName(e.target.value);setSlug(slugify(e.target.value))}}/></label><label>Identificador único<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} placeholder="cafe-noma" onChange={e=>setSlug(slugify(e.target.value))}/></label><label>Email del responsable<input type="email" required value={manager} placeholder="responsable@negocio.com" onChange={e=>setManager(e.target.value)}/></label><button className="button button-dark button-full" disabled={busy}>{busy?"Creando...":"Crear negocio"} <ArrowUpRight size={17}/></button></div></form></div>}
 {tab==="users"&&<div className="panel-card"><h2>Directorio global de usuarios</h2><p className="muted">Visión administrativa de cuentas y programas a los que están vinculadas.</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Nombre</th><th>Email</th><th>Programas</th><th>Alta</th><th></th></tr></thead><tbody>{users.map(u=><tr key={u.user_id}><td><strong>{u.full_name||"Sin nombre"}</strong></td><td>{u.email}</td><td>{u.businesses}</td><td>{dateShort(u.joined_at)}</td><td><button className="inline-table-button" onClick={()=>inspectUser(u)}>Ver programas</button></td></tr>)}</tbody></table></div>
 {focusUser&&<div className="admin-inspector"><div className="inspector-head"><div><strong>{focusUser.full_name||focusUser.email}</strong><small>{focusUser.email}</small></div><button onClick={()=>setFocusUser(null)} className="inline-table-button">Cerrar</button></div>
 {focusCards.length?focusCards.map(c=><div className="activity-row" key={c.business_id}><div className="activity-icon positive"><Store size={17}/></div><div><strong>{c.businesses?.name||c.business_id}</strong><span>Saldo de tarjeta: {c.balance} unidades internas</span></div></div>):<p className="muted">No figura en ningún programa.</p>}</div>}
 </div>}
 {tab==="campaigns"&&<div className="admin-grid"><form onSubmit={saveDraft} className="panel-card"><div className="panel-icon"><Mail size={22}/></div><h2>Campañas de plataforma</h2><p className="muted">Prepara novedades sobre nuevos negocios. Solo podrá enviarse a usuarios con consentimiento cuando integremos un proveedor de email.</p><div className="form-stack"><label>Asunto<input value={subject} maxLength={180} required onChange={e=>setSubject(e.target.value)} placeholder="¡Nuevos sitios para descubrir!"/></label><label>Contenido<textarea required rows={8} value={body} onChange={e=>setBody(e.target.value)} placeholder="Escribe el mensaje..."/></label><button disabled={busy} className="button button-dark">Guardar borrador <FileText size={17}/></button></div></form><section className="panel-card"><h2>Borradores guardados</h2>{drafts.map(c=><div className="activity-row" key={c.id}><div className="activity-icon positive"><Mail size={18}/></div><div><strong>{c.subject}</strong><span>{dateShort(c.created_at)} · No enviado</span></div></div>)}{!drafts.length&&<p className="muted">Sin campañas todavía.</p>}</section></div>}
 </>;
}
export default function AdminPage(){return <AppFrame area="admin" title="Vista general del ecosistema" subtitle="Todos tus negocios y comunidades, en un único lugar.">{a=><AdminContent account={a}/>}</AppFrame>}
