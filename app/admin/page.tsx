"use client";
import {useEffect,useState} from "react";
import {Activity,ArrowUpRight,Check,ChevronDown,FileText,Mail,Plus,Search,Shield,Store,Users} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {AddressPicker} from "@/components/AddressPicker";
import {db} from "@/lib/supabase";
import {dateShort} from "@/lib/format";
import {CURRENCIES} from "@/lib/currency";
type Biz={id:string;name:string;slug:string;currency:string;category:string|null;parent_business_id:string|null;active:boolean;public_listing:boolean;created_at:string};
type Person={user_id:string;full_name:string;email:string;businesses:number;joined_at:string};
type Lead={id:string;business_name:string;contact_name:string;contact_email:string;category:string|null;city:string;message:string|null;status:"new"|"contacted"|"converted"|"archived";created_at:string};
type RecentOperation={business_id:string;kind:string;created_at:string};
function AdminContent({account}:{account:Account}){
 const [tab,setTab]=useState<"business"|"users"|"campaigns"|"leads"|"reports">("business"),[businesses,setBusinesses]=useState<Biz[]>([]),[users,setUsers]=useState<Person[]>([]),[transactionCount,setTransactionCount]=useState(0),[membershipCount,setMembershipCount]=useState(0),[search,setSearch]=useState("");
 const [leads,setLeads]=useState<Lead[]>([]);
 const [businessView,setBusinessView]=useState<"list"|"create">("list"),[newCurrency,setNewCurrency]=useState("MXN");
 const [recentOperations,setRecentOperations]=useState<RecentOperation[]>([]);
 const [focusRate,setFocusRate]=useState("0.01"),[focusWhatsappRate,setFocusWhatsappRate]=useState(""),[focusPushRate,setFocusPushRate]=useState("0.00"),[focusCurrency,setFocusCurrency]=useState("MXN"),[hasFocusRate,setHasFocusRate]=useState(false);
 const [focusBiz,setFocusBiz]=useState<Biz|null>(null),[focusCustomers,setFocusCustomers]=useState(0),[focusStaff,setFocusStaff]=useState(0),[focusTx,setFocusTx]=useState(0),[focusLocations,setFocusLocations]=useState(0),[focusProgram,setFocusProgram]=useState("");
 const [focusUser,setFocusUser]=useState<Person|null>(null),[focusCards,setFocusCards]=useState<{business_id:string;balance:number;businesses:{name:string;slug:string}|null}[]>([]);
 const [parentBusiness,setParentBusiness]=useState(""),[existingProgram,setExistingProgram]=useState(""),[contractPrice,setContractPrice]=useState("");
 const [locName,setLocName]=useState(""),[locAddress,setLocAddress]=useState(""),[locCity,setLocCity]=useState(""),[locCountry,setLocCountry]=useState("México"),[locLat,setLocLat]=useState(""),[locLng,setLocLng]=useState("");
 const [focusContractPrice,setFocusContractPrice]=useState(""),[focusOwner,setFocusOwner]=useState("");
 const [name,setName]=useState(""),[slug,setSlug]=useState(""),[manager,setManager]=useState(""),[subject,setSubject]=useState(""),[body,setBody]=useState(""),[drafts,setDrafts]=useState<{id:string;subject:string;created_at:string}[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 async function load(){const [b,u,t,m,c,l,op]=await Promise.all([
  db().from("businesses").select("id,name,slug,category,currency,parent_business_id,active,public_listing,created_at").order("created_at",{ascending:false}),
  db().rpc("admin_user_directory"),
  db().from("loyalty_transactions").select("id",{head:true,count:"exact"}),
  db().from("loyalty_memberships").select("id",{head:true,count:"exact"}),
  db().from("marketing_campaigns").select("id,subject,created_at").is("business_id",null).order("created_at",{ascending:false}),
  db().from("business_leads").select("*").order("created_at",{ascending:false}),
  db().from("loyalty_transactions").select("business_id,kind,created_at").order("created_at",{ascending:false}).limit(500)
 ]);
 setBusinesses((b.data||[]) as Biz[]);setUsers((u.data||[]) as Person[]);setTransactionCount(t.count||0);setMembershipCount(m.count||0);setDrafts(c.data||[]);setLeads((l.data||[]) as Lead[]);setRecentOperations((op.data||[]) as RecentOperation[]);
 if(b.error||u.error||l.error)setError(b.error?.message||u.error?.message||l.error?.message||"Error cargando datos");
 }
 useEffect(()=>{load()},[]);
 function slugify(v:string){return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
 async function createBusiness(e:React.FormEvent){
  e.preventDefault();setError("");setSuccess("");
  const price=contractPrice.trim()===""?null:Math.round(Number(contractPrice)*100);
  if(price!==null&&(!Number.isSafeInteger(price)||price<0)){setError("Indica un precio mensual válido o deja el campo en blanco.");return;}
  setBusy(true);
  const {data,error}=await db().rpc("admin_provision_business",{
   p_name:name,p_slug:slug,p_owner_email:manager,p_parent_business:parentBusiness||null,
   p_existing_program:existingProgram||null,p_monthly_price_cents:price
  });
  setBusy(false);
  if(error){setError(error.message);return}
  const currencyResult=await db().rpc("admin_set_business_currency",{p_business:data,p_currency:newCurrency});
  if(currencyResult.error){setError("El negocio se creó, pero debes revisar su moneda: "+currencyResult.error.message);setBusinessView("list");await load();return}
  setSuccess("Negocio creado.");
  setName("");setSlug("");setManager("");setParentBusiness("");setExistingProgram("");setContractPrice("");setNewCurrency("MXN");setBusinessView("list");
  await load();
  const biz=(await db().from("businesses").select("id,name,slug,category,currency,parent_business_id,active,public_listing,created_at").eq("id",data as string).maybeSingle()).data;
  if(biz)await inspectBusiness(biz as Biz);
 }
 async function saveDraft(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setSuccess("");
 const {error}=await db().from("marketing_campaigns").insert({business_id:null,created_by:account.user.id,subject,body_text:body,status:"draft"});
 setBusy(false);if(error){setError(error.message);return}
 setSubject("");setBody("");setSuccess("Borrador guardado. No se ha enviado ningún correo.");await load()
 }
 async function inspectBusiness(b:Biz){setFocusBiz(b);setError("");
  const [c,s,t,l,p,r,loc,contract,owners,pending]=await Promise.all([
   db().rpc("business_customer_directory",{p_business:b.id}),
   db().rpc("business_staff_directory",{p_business:b.id}),
   db().from("loyalty_transactions").select("id",{count:"exact",head:true}).eq("business_id",b.id),
   db().from("business_locations").select("id",{count:"exact",head:true}).eq("business_id",b.id),
   db().from("loyalty_programs").select("type").eq("business_id",b.id).maybeSingle(),
   db().from("business_marketing_rates").select("price_cents,whatsapp_price_cents,push_price_cents,currency").eq("business_id",b.id).maybeSingle(),
   db().from("business_locations").select("*").eq("business_id",b.id).limit(1),
   db().from("business_billing").select("agreed_monthly_cents").eq("business_id",b.id).maybeSingle(),
   db().from("business_members").select("user_id").eq("business_id",b.id).eq("role","owner").eq("active",true),
   db().from("business_invitations").select("email").eq("business_id",b.id).eq("role","owner").is("claimed_at",null)
  ]);
  setFocusCustomers(c.data?.length||0);setFocusStaff(s.data?.length||0);setFocusTx(t.count||0);setFocusLocations(l.count||0);setFocusProgram(p.data?.type||"—");setFocusRate((Number(r.data?.price_cents??1)/100).toFixed(2));setFocusWhatsappRate(r.data?.whatsapp_price_cents==null?"":(Number(r.data.whatsapp_price_cents)/100).toFixed(2));setFocusPushRate((Number(r.data?.push_price_cents??0)/100).toFixed(2));setFocusCurrency(b.currency||"MXN");setHasFocusRate(!!r.data);
  const l0=(loc.data||[])[0];
  setLocName(l0?.name||b.name);setLocAddress(l0?.address||"");setLocCity(l0?.city||"");setLocCountry(l0?.country||"México");setLocLat(l0?String(l0.lat):"");setLocLng(l0?String(l0.lng):"");
  setFocusContractPrice(contract.data?.agreed_monthly_cents==null?"":String(Number(contract.data.agreed_monthly_cents)/100));
  setFocusOwner((pending.data||[]).map((x:{email:string})=>x.email).join(", ")||(owners.data?.length?"Propietario registrado":"Invitación pendiente"));
 }
 async function inspectUser(u:Person){setFocusUser(u);setError("");
  const {data,error}=await db().from("loyalty_memberships").select("business_id,balance,businesses(name,slug)").eq("customer_id",u.user_id);
  if(error){setError(error.message);return}
  setFocusCards((data||[]) as unknown as {business_id:string;balance:number;businesses:{name:string;slug:string}|null}[]);
 }
 async function saveBusinessLocation(e:React.FormEvent){
  e.preventDefault();
  if(!focusBiz)return;
  if(!locLat||!locLng){setError("Elige primero la ubicación en el mapa.");return}
  setBusy(true);setError("");
  const {error}=await db().rpc("admin_set_business_location",{
   p_business:focusBiz.id,p_name:locName,p_address:locAddress,p_city:locCity,p_country:locCountry,
   p_lat:Number(locLat),p_lng:Number(locLng)
  });
  setBusy(false);
  if(error){setError(error.message);return}
  setSuccess("Dirección asignada. El propietario puede editarla, pero no crear otros locales.");await inspectBusiness(focusBiz);
 }
 async function saveBusinessContract(){
  if(!focusBiz)return;
  const cents=focusContractPrice.trim()===""?null:Math.round(Number(focusContractPrice)*100);
  if(cents!==null&&(!Number.isSafeInteger(cents)||cents<0)){setError("Indica un importe mensual válido.");return}
  setBusy(true);setError("");
  const {error}=await db().rpc("admin_set_business_contract",{p_business:focusBiz.id,p_monthly_price_cents:cents});
  setBusy(false);if(error){setError(error.message);return}
  setSuccess("Condición comercial actualizada para este establecimiento.");await inspectBusiness(focusBiz);
 }
 async function saveMarketingRate(){
  if(!focusBiz)return;
  const value=Math.round(Number(focusRate)*100),whatsapp=focusWhatsappRate.trim()===""?null:Math.round(Number(focusWhatsappRate)*100),push=Math.round(Number(focusPushRate)*100);
  if(whatsapp!==null&&(!Number.isInteger(whatsapp)||whatsapp<0||whatsapp>100000)){setError("La tarifa de WhatsApp debe ser un número entero de centavos o estar vacía.");return}
  if(!Number.isInteger(value)||value<0||value>100000){setError("La tarifa debe expresarse en centavos enteros.");return}
   if(focusPushRate.trim()===""||!Number.isInteger(push)||push<0||push>100000){setError("La tarifa push debe ser un número entero de centavos (0 para gratis).");return}
  setBusy(true);setError("");
  if(focusBiz.currency!==focusCurrency){
   const currencyResult=await db().rpc("admin_set_business_currency",{p_business:focusBiz.id,p_currency:focusCurrency});
   if(currencyResult.error){setBusy(false);setError(currencyResult.error.message);return}
  }
  const {error}=hasFocusRate?await db().from("business_marketing_rates").update({price_cents:value,whatsapp_price_cents:whatsapp,push_price_cents:push,currency:focusCurrency,updated_at:new Date().toISOString()}).eq("business_id",focusBiz.id):
   await db().from("business_marketing_rates").insert({business_id:focusBiz.id,price_cents:value,whatsapp_price_cents:whatsapp,push_price_cents:push,currency:focusCurrency});
  setBusy(false);if(error){setError(error.message);return}
  setSuccess("Moneda y precios guardados.");await load();await inspectBusiness({...focusBiz,currency:focusCurrency});
 }
 async function changeActive(){if(!focusBiz)return;
  if(!window.confirm(focusBiz.active?"¿Suspender este negocio? Los empleados no podrán registrar compras.":"¿Reactivar este negocio?"))return;
  setBusy(true);const {error}=await db().from("businesses").update({active:!focusBiz.active}).eq("id",focusBiz.id);
  setBusy(false);if(error){setError(error.message);return}
  setSuccess("Estado del negocio actualizado.");await inspectBusiness({...focusBiz,active:!focusBiz.active});await load();
 }
 async function updateLead(lead:Lead,status:Lead["status"]){
  setBusy(true);setError("");setSuccess("");
  const {error}=await db().from("business_leads").update({status,updated_at:new Date().toISOString()}).eq("id",lead.id);
  setBusy(false);
  if(error){setError(error.message);return}
  setSuccess("Solicitud actualizada.");await load();
 }
 async function convertLead(lead:Lead){
  const candidate=window.prompt("Identificador único para el nuevo negocio:",slugify(lead.business_name));
  if(candidate===null)return;
  const slug=slugify(candidate);
  if(!slug){setError("Identificador no válido.");return}
  setBusy(true);setError("");setSuccess("");
  const {error}=await db().rpc("admin_convert_lead",{p_lead:lead.id,p_slug:slug});
  setBusy(false);
  if(error){setError(error.message);return}
  setSuccess("Negocio creado e invitación preparada para "+lead.contact_email+". El email se verificará cuando el responsable entre; no se ha enviado automáticamente una invitación.");
  await load();
 }
 const list=businesses.filter(b=>(b.name+" "+b.slug).toLowerCase().includes(search.toLowerCase()));
 return <><div className="kpi-grid"><div className="kpi-card"><div className="kpi-symbol green"><Store/></div><span>Negocios registrados</span><strong>{businesses.length}</strong><small>{businesses.filter(b=>b.active).length} activos</small></div><div className="kpi-card"><div className="kpi-symbol peach"><Users/></div><span>Usuarios</span><strong>{users.length}</strong><small>Cuentas de la plataforma</small></div><div className="kpi-card"><div className="kpi-symbol purple"><Activity/></div><span>Tarjetas creadas</span><strong>{membershipCount}</strong><small>En todos los negocios</small></div><div className="kpi-card"><div className="kpi-symbol pink"><Shield/></div><span>Operaciones registradas</span><strong>{transactionCount}</strong><small>Historial global</small></div></div>
 <div className="workspace-section-layout"><aside className="workspace-section-menu" aria-label="Apartados de administración"><strong>ADMINISTRACIÓN</strong><button className={tab==="business"?"active":""} onClick={()=>setTab("business")}><Store size={17}/> Negocios</button><button className={tab==="users"?"active":""} onClick={()=>setTab("users")}><Users size={17}/> Usuarios</button><button className={tab==="leads"?"active":""} onClick={()=>setTab("leads")}><Mail size={17}/> Solicitudes ({leads.filter(x=>x.status==="new").length})</button><button className={tab==="campaigns"?"active":""} onClick={()=>setTab("campaigns")}><Mail size={17}/> Marketing de plataforma</button><button className={tab==="reports"?"active":""} onClick={()=>setTab("reports")}><Activity size={17}/> Informes</button></aside><div className="workspace-section-body">
 {error&&<div className="alert error">{error}</div>}{success&&<div className="alert success"><Check size={17}/>{success}</div>}
 {tab==="business"&&<div className="admin-grid">{businessView==="list"?<div className="panel-card"><div className="content-heading"><div><h2>Red de negocios</h2><p>Todos los establecimientos registrados.</p></div><button type="button" className="button button-dark button-sm" onClick={()=>{setBusinessView("create");setFocusBiz(null);setError("");setSuccess("")}}><Plus size={17}/> Crear negocio</button></div><div className="search-box small-search"><Search size={17}/><input placeholder="Buscar negocio..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Negocio</th><th>Estado</th><th>Directorio</th><th>Fecha</th><th></th></tr></thead><tbody>{list.map(b=><tr key={b.id}><td><strong>{b.name}</strong><small>/{b.slug}</small></td><td><span className={"table-pill "+(b.active?"":"inactive")}>{b.active?"Activo":"Inactivo"}</span></td><td>{b.public_listing?"Visible":"Oculto"}</td><td>{dateShort(b.created_at)}</td><td><button className="inline-table-button" onClick={()=>inspectBusiness(b)}>Detalles</button></td></tr>)}</tbody></table></div>{!list.length&&<p className="muted">No hay negocios con ese filtro.</p>}
 {focusBiz&&<div className="admin-inspector"><div className="inspector-head"><div><strong>{focusBiz.name}</strong><small>/{focusBiz.slug}</small></div><button onClick={()=>setFocusBiz(null)} className="inline-table-button">Cerrar</button></div><div className="inspector-stats"><div><strong>{focusCustomers}</strong><span>Clientes</span></div><div><strong>{focusStaff}</strong><span>Equipo</span></div><div><strong>{focusTx}</strong><span>Operaciones</span></div><div><strong>{focusLocations}</strong><span>Locales</span></div></div><p className="muted">Programa: <strong>{focusProgram}</strong> · Directorio: {focusBiz.public_listing?"Visible":"Oculto"}</p>
 <div className="admin-ownership-contract"><p><strong>Propietario:</strong> {focusOwner}</p><p><strong>Grupo:</strong> {focusBiz.parent_business_id?businesses.find(x=>x.id===focusBiz.parent_business_id)?.name||"Franquicia":"Independiente"}</p>
  <div className="form-stack"><label>Precio mensual acordado (en {focusCurrency})<input type="number" step="0.01" min="0" value={focusContractPrice} onChange={e=>setFocusContractPrice(e.target.value)} placeholder="Sin precio acordado"/></label><button type="button" className="button button-outline button-sm" disabled={busy} onClick={saveBusinessContract}>Guardar precio del establecimiento</button><small>Este importe es un acuerdo comercial, no genera por sí mismo ningún cargo ni modifica Stripe.</small></div>
 </div>
 <form className="admin-location-form" onSubmit={saveBusinessLocation}>
  <h3>Dirección del establecimiento</h3>
  <div className="form-stack"><label>Nombre del local<input required value={locName} minLength={2} onChange={e=>setLocName(e.target.value)}/></label><AddressPicker address={locAddress} city={locCity} country={locCountry} lat={locLat} lng={locLng} onAddressChange={setLocAddress} onCityChange={setLocCity} onCountryChange={setLocCountry} onCoordinatesChange={(lat,lng)=>{setLocLat(lat);setLocLng(lng)}}/>
   <button type="submit" className="button button-outline button-sm" disabled={busy}>Guardar dirección</button>
  </div>
 </form>
 <div className="form-stack marketing-rate-admin"><h3>Precio de cada campaña</h3>
  <label>Moneda del negocio<select value={focusCurrency} onChange={e=>setFocusCurrency(e.target.value)}>{CURRENCIES.map(({code,label})=><option key={code} value={code}>{label} ({code})</option>)}</select></label><small>Los importes existentes no se convierten al cambiar de moneda.</small>
  <div className="marketing-tariff-grid">
   <label>Correo por cliente<input type="number" min="0" max="1000" step="0.01" value={focusRate}
    onChange={e=>setFocusRate(e.target.value)}/></label>
   <label>WhatsApp por cliente<input type="number" min="0" max="1000" step="0.01"
    value={focusWhatsappRate}
    onChange={e=>setFocusWhatsappRate(e.target.value)} placeholder="Sin activar"/></label>
   <label>Push por cliente<input type="number" min="0" max="1000" step="0.01"
    value={focusPushRate}
    onChange={e=>setFocusPushRate(e.target.value)}/></label>
  </div>
  <button type="button" className="button button-dark button-sm" disabled={busy} onClick={saveMarketingRate}>Guardar precios</button>
 </div>
 <button className={"button "+(focusBiz.active?"button-danger":"button-dark")+" button-sm"} disabled={busy} onClick={changeActive}>{focusBiz.active?"Suspender negocio":"Reactivar negocio"}</button></div>}
 </div>
 :<form className="panel-card admin-create-business" onSubmit={createBusiness}><button type="button" className="campaign-editor-back" onClick={()=>{setBusinessView("list");setError("")}}>← Volver al listado</button><div className="panel-icon"><Plus size={22}/></div><h2>Nuevo negocio</h2><div className="form-stack"><label>Nombre del negocio<input required minLength={2} value={name} placeholder="Ej. Café Noma" onChange={e=>{setName(e.target.value);setSlug(slugify(e.target.value))}}/></label><label>Identificador único<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} placeholder="cafe-noma" onChange={e=>setSlug(slugify(e.target.value))}/></label><label>Email del responsable<input type="email" required value={manager} placeholder="responsable@negocio.com" onChange={e=>setManager(e.target.value)}/></label>
 <label>Grupo empresarial o franquicia (opcional)<select value={parentBusiness} onChange={e=>setParentBusiness(e.target.value)}><option value="">Negocio independiente</option>{businesses.filter(x=>!x.parent_business_id&&x.active).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><small>Los locales de una cadena se agrupan bajo la misma empresa matriz, pero se contabilizan por separado.</small></label>
 <label>Usar el diseño de una tarjeta existente (opcional)<select value={existingProgram} onChange={e=>setExistingProgram(e.target.value)}><option value="">Crear programa independiente</option>{businesses.filter(x=>x.active).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><small>Copia diseño y reglas iniciales; los saldos de los clientes permanecen independientes en cada negocio.</small></label>
 <label>Moneda del negocio<select value={newCurrency} onChange={e=>setNewCurrency(e.target.value)}>{CURRENCIES.map(({code,label})=><option value={code} key={code}>{label} ({code})</option>)}</select></label><label>Precio mensual pactado ({newCurrency})<input type="number" min="0" step="0.01" value={contractPrice} onChange={e=>setContractPrice(e.target.value)} placeholder="Se acuerda individualmente"/><small>Se pueden aplicar condiciones especiales por volumen. Este registro no genera cargos automáticamente.</small></label><button className="button button-dark button-full" disabled={busy}>{busy?"Creando...":"Crear negocio"} <ArrowUpRight size={17}/></button></div></form>}</div>}
 {tab==="users"&&<div className="panel-card"><h2>Directorio global de usuarios</h2><p className="muted">Visión administrativa de cuentas y programas a los que están vinculadas.</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Nombre</th><th>Email</th><th>Programas</th><th>Alta</th><th></th></tr></thead><tbody>{users.map(u=><tr key={u.user_id}><td><strong>{u.full_name||"Sin nombre"}</strong></td><td>{u.email}</td><td>{u.businesses}</td><td>{dateShort(u.joined_at)}</td><td><button className="inline-table-button" onClick={()=>inspectUser(u)}>Ver programas</button></td></tr>)}</tbody></table></div>
 {focusUser&&<div className="admin-inspector"><div className="inspector-head"><div><strong>{focusUser.full_name||focusUser.email}</strong><small>{focusUser.email}</small></div><button onClick={()=>setFocusUser(null)} className="inline-table-button">Cerrar</button></div>
 {focusCards.length?focusCards.map(c=><div className="activity-row" key={c.business_id}><div className="activity-icon positive"><Store size={17}/></div><div><strong>{c.businesses?.name||c.business_id}</strong><span>Saldo de tarjeta: {c.balance} unidades internas</span></div></div>):<p className="muted">No figura en ningún programa.</p>}</div>}
 </div>}
 {tab==="leads"&&<div className="panel-card"><div className="content-heading"><div><h2>Solicitudes de acceso</h2><p>Revisa cada negocio y conviértelo manualmente en cliente cuando proceda.</p></div><span className="table-pill">{leads.length} solicitudes</span></div>
 <div className="table-wrap"><table className="data-table"><thead><tr><th>Negocio</th><th>Persona</th><th>Ubicación</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
 <tbody>{leads.map(l=><tr key={l.id}>
  <td><strong>{l.business_name}</strong><small>{l.category||"Sector no indicado"}</small></td>
  <td><strong>{l.contact_name}</strong><small>{l.contact_email}</small></td>
  <td>{l.city}</td><td>{dateShort(l.created_at)}</td>
  <td><span className={"table-pill "+(l.status==="converted"?"":"inactive")}>{l.status==="new"?"Nueva":l.status==="contacted"?"Contactado":l.status==="converted"?"Convertida":"Archivada"}</span></td>
  <td><div className="lead-actions">
   {l.status!=="converted"&&<button disabled={busy} type="button" className="inline-table-button" onClick={()=>convertLead(l)}>Crear negocio</button>}
   {l.status==="new"&&<button disabled={busy} type="button" className="inline-table-button" onClick={()=>updateLead(l,"contacted")}>Contactado</button>}
   {l.status!=="archived"&&l.status!=="converted"&&<button disabled={busy} type="button" className="inline-table-button" onClick={()=>updateLead(l,"archived")}>Archivar</button>}
  </div></td>
 </tr>)}</tbody></table></div>
 {!leads.length&&<p className="muted">Todavía no se han recibido solicitudes.</p>}
 <p className="tiny-note">Las solicitudes no activan cuentas ni cobran automáticamente. Antes de crear un negocio, comprueba sus datos y acuerda las condiciones.</p>
 </div>}
 {tab==="reports"&&<div className="admin-grid"><section className="panel-card"><div className="panel-icon"><Activity size={22}/></div><h2>Actividad global de la red</h2><p className="muted">Vista consolidada de todos los negocios con operaciones reales.</p><div className="overview-stat"><span>Negocios registrados</span><strong>{businesses.length}</strong></div><div className="overview-stat"><span>Clientes registrados</span><strong>{users.length}</strong></div><div className="overview-stat"><span>Tarjetas emitidas</span><strong>{membershipCount}</strong></div><div className="overview-stat"><span>Operaciones históricas</span><strong>{transactionCount}</strong></div><div className="overview-stat"><span>Canjes recientes (últimas 500 operaciones)</span><strong>{recentOperations.filter(t=>t.kind==="redeem").length}</strong></div></section><section className="panel-card"><h2>Actividad por establecimiento</h2><p className="muted">Distribución de las últimas 500 operaciones, no del histórico completo.</p>{businesses.map(b=>({name:b.name,count:recentOperations.filter(t=>t.business_id===b.id).length})).filter(b=>b.count>0).sort((a,b)=>b.count-a.count).slice(0,8).map((b,i)=><div key={i} className="admin-report-row"><div><strong>{b.name}</strong><span>{b.count} movimientos</span></div><div className="admin-report-track"><div style={{width:(recentOperations.length?b.count/recentOperations.length*100:0)+"%"}}/></div></div>)}{recentOperations.length===0&&<p className="muted">Aún no hay operaciones registradas.</p>}</section></div>}
 {tab==="campaigns"&&<div className="admin-grid"><form onSubmit={saveDraft} className="panel-card"><div className="panel-icon"><Mail size={22}/></div><h2>Campañas de plataforma</h2><p className="muted">Prepara novedades sobre nuevos negocios. Solo podrá enviarse a usuarios con consentimiento cuando integremos un proveedor de email.</p><div className="form-stack"><label>Asunto<input value={subject} maxLength={180} required onChange={e=>setSubject(e.target.value)} placeholder="¡Nuevos sitios para descubrir!"/></label><label>Contenido<textarea required rows={8} value={body} onChange={e=>setBody(e.target.value)} placeholder="Escribe el mensaje..."/></label><button disabled={busy} className="button button-dark">Guardar borrador <FileText size={17}/></button></div></form><section className="panel-card"><h2>Borradores guardados</h2>{drafts.map(c=><div className="activity-row" key={c.id}><div className="activity-icon positive"><Mail size={18}/></div><div><strong>{c.subject}</strong><span>{dateShort(c.created_at)} · No enviado</span></div></div>)}{!drafts.length&&<p className="muted">Sin campañas todavía.</p>}</section></div>}
 </div></div></>;
}
export default function AdminPage(){return <AppFrame area="admin" title="Vista general del ecosistema" subtitle="Todos tus negocios y comunidades, en un único lugar.">{a=><AdminContent account={a}/>}</AppFrame>}
