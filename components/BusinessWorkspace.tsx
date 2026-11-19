"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {Activity,ArrowUpRight,BarChart3,Brush,Check,ChevronDown,CircleHelp,Clock3,CreditCard,FileText,Gift,ImagePlus,MapPin,Mail,Menu,Plus,Settings2,ShieldCheck,Store,Ticket,ToggleLeft,Trash2,Users,Wallet} from "lucide-react";
import type {Account} from "@/components/AppFrame";
import type {Business,Program,Location} from "@/lib/types";
import {dateShort,initials,units} from "@/lib/format";
import {db} from "@/lib/supabase";
import {STAMP_OPTIONS,StampMark} from "@/components/StampMarks";
import {StampCard} from "@/components/StampCard";
import {demoRole} from "@/lib/demo-local";
import {BUSINESS_CATEGORIES,categoryStampKind} from "@/lib/business-categories";
type Tab="overview"|"settings"|"designer"|"program"|"team"|"customers"|"locations"|"reports"|"marketing";
const tabs:{id:Tab;label:string;icon:React.ReactNode}[]=[
 {id:"overview",label:"Resumen",icon:<BarChart3 size={17}/>},
 {id:"settings",label:"Negocio",icon:<Store size={17}/>},
 {id:"designer",label:"Diseñar mi tarjeta",icon:<Brush size={17}/>},
 {id:"program",label:"Premios y sellos",icon:<Gift size={17}/>},
 {id:"team",label:"Empleados",icon:<Users size={17}/>},
 {id:"customers",label:"Clientes",icon:<CreditCard size={17}/>},
 {id:"locations",label:"Ubicaciones",icon:<MapPin size={17}/>},
 {id:"reports",label:"Resultados",icon:<Activity size={17}/>},
 {id:"marketing",label:"Mensajes y ofertas",icon:<Mail size={17}/>}
];
type Customer={user_id:string;full_name:string;email:string;balance:number;total_earned:number;visits:number;marketing_ok:boolean;joined_at:string};
type Employee={user_id:string;full_name:string;email:string;role:string;active:boolean};
type Tx={id:string;kind:"earn"|"redeem"|"reversal";amount_delta:number;purchase_cents:number|null;ticket_ref:string|null;created_at:string;membership_id:string;employee_id:string|null;reversal_of:string|null;reversal_reason:string|null};
type Draft={id:string;subject:string;body_text:string;created_at:string;status:string;recipient_count?:number;sent_count?:number;failed_count?:number};
type MailQuote={contacts:number;price_cents:number;total_cents:number;currency:string};
const COLOR_PRESETS=["#264d3e","#7760a5","#c9784f","#273550","#a14460","#1d1d1d","#367666","#a35f75","#2c73ac","#dfac5c","#b33c3c","#134e4a","#6d28d9","#f97316","#0f172a","#edf4e9","#f4e8db","#f9cadf","#ffffff","#000000"];
export default function BusinessWorkspace({account}:{account:Account}){
 const manageable=account.businesses.filter(b=>b.role!=="employee");
 const [selected,setSelected]=useState(manageable[0]?.business_id||""),[tab,setTab]=useState<Tab>("overview");
 const [sectionsOpen,setSectionsOpen]=useState(false);
 const [biz,setBiz]=useState<Business|null>(null),[prog,setProg]=useState<Program|null>(null),[customers,setCustomers]=useState<Customer[]>([]),[staff,setStaff]=useState<Employee[]>([]),[invites,setInvites]=useState<{id:string;email:string;role:string;created_at:string}[]>([]),[locations,setLocations]=useState<Location[]>([]),[transactions,setTransactions]=useState<Tx[]>([]),[drafts,setDrafts]=useState<Draft[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [activity,setActivity]=useState<{user_id:string;employee_name:string;operations:number;awarded_units:number}[]>([]);
 const [inviteEmail,setInviteEmail]=useState(""),[inviteRole,setInviteRole]=useState("employee");
 const [locationName,setLocationName]=useState(""),[address,setAddress]=useState(""),[city,setCity]=useState("Tijuana"),[country,setCountry]=useState("México"),[lat,setLat]=useState(""),[lng,setLng]=useState("");
 const [mailSubject,setMailSubject]=useState(""),[mailBody,setMailBody]=useState(""),[quote,setQuote]=useState<MailQuote|null>(null);
 const [previewEarned,setPreviewEarned]=useState(3),[siteOrigin,setSiteOrigin]=useState("");
 useEffect(()=>{setSiteOrigin(window.location.origin)},[]);
 const reload=useCallback(async()=>{
  if(!selected)return;setLoading(true);setError("");
  const [b,p,c,s,i,l,t,d,a]=await Promise.all([
   db().from("businesses").select("*").eq("id",selected).maybeSingle(),
   db().from("loyalty_programs").select("*").eq("business_id",selected).maybeSingle(),
   db().rpc("business_customer_directory",{p_business:selected}),
   db().rpc("business_staff_directory",{p_business:selected}),
   db().from("business_invitations").select("id,email,role,created_at").eq("business_id",selected).is("claimed_at",null),
   db().from("business_locations").select("*").eq("business_id",selected),
   db().from("loyalty_transactions").select("id,kind,amount_delta,purchase_cents,ticket_ref,created_at,membership_id,employee_id,reversal_of,reversal_reason").eq("business_id",selected).order("created_at",{ascending:false}).limit(250),
   db().from("marketing_campaigns").select("id,subject,body_text,status,recipient_count,sent_count,failed_count,created_at").eq("business_id",selected).order("created_at",{ascending:false}),
   db().rpc("business_employee_activity",{p_business:selected,p_days:30})
  ]);
  setBiz(b.data as Business|null);setProg(p.data as Program|null);setCustomers((c.data||[]) as Customer[]);
  setStaff((s.data||[]) as Employee[]);setInvites(i.data||[]);setLocations((l.data||[]) as Location[]);
  setTransactions((t.data||[]) as Tx[]);setDrafts((d.data||[]) as Draft[]);setActivity((a.data||[]) as {user_id:string;employee_name:string;operations:number;awarded_units:number}[]);
  const failure=b.error||p.error||c.error||s.error||i.error||l.error||t.error||d.error||a.error;
  if(failure)setError(failure.message);
  const pricing=await db().rpc("business_mail_quote",{p_business:selected});
  setQuote(pricing.error?null:((pricing.data||[])[0] as MailQuote||null));
  setLoading(false);
 },[selected]);
 useEffect(()=>{reload()},[reload]);
 function success(s:string){setNotice(s);setError("")}
 async function saveBusiness(fields:Partial<Business>){if(!selected)return;setBusy(true);setError("");setNotice("");
 const {error}=await db().from("businesses").update(fields).eq("id",selected);
 setBusy(false);if(error){setError(error.message);return}success("Cambios guardados correctamente.");await reload();
 }
 async function saveProgram(e:React.FormEvent){e.preventDefault();if(!prog)return;setBusy(true);setError("");setNotice("");
 const {error}=await db().from("loyalty_programs").update({
  type:prog.type,reward_label:prog.reward_label,reward_cost:Number(prog.reward_cost),cashback_bps:Number(prog.cashback_bps),
  points_per_euro:Number(prog.points_per_euro),max_stamps_per_action:Number(prog.max_stamps_per_action),
  max_ticket_cents:Number(prog.max_ticket_cents),min_seconds_between_awards:Number(prog.min_seconds_between_awards),
  max_daily_awards_per_employee:Number(prog.max_daily_awards_per_employee),require_ticket_reference:prog.require_ticket_reference,updated_at:new Date().toISOString()
 }).eq("id",prog.id);
 setBusy(false);if(error){setError(error.message);return}success("Programa actualizado. Los saldos existentes se mantienen; evita cambiar de modalidad después de admitir clientes.");await reload()
 }

 async function saveDesigner(){
  if(!biz||!prog)return;
  setBusy(true);setError("");setNotice("");
  const {error:visualError}=await db().from("businesses").update({
   accent_color:biz.accent_color,card_text:biz.card_text,
   card_text_color:biz.card_text_color||"#ffffff",stamp_color:biz.stamp_color||"#275642",
   stamp_icon:biz.stamp_icon||"coffee",stamp_image_url:biz.stamp_image_url||null
  }).eq("id",selected);
  if(visualError){setBusy(false);setError(visualError.message);return}
  const programChanges:Record<string,unknown>={reward_label:prog.reward_label};
  if(prog.type==="stamps"){
   programChanges.reward_cost=Math.min(30,Math.max(2,Number(prog.reward_cost)||8));
   programChanges.max_stamps_per_action=Math.min(100,Math.max(1,Number(prog.max_stamps_per_action)||1));
  }
  const {error:programError}=await db().from("loyalty_programs").update(programChanges).eq("business_id",selected);
  if(programError){setBusy(false);setError("El diseño se guardó, pero no se actualizó el programa: "+programError.message);return}
  setBusy(false);success("Tarjeta y configuración guardadas. Los clientes verán el diseño actualizado.");await reload();
 }
 async function reverseTransaction(transaction:Tx){
  if(transaction.kind==="reversal" || transactions.some(t=>t.reversal_of===transaction.id))return;
  const reason=window.prompt("Motivo de la corrección (8-300 caracteres). La operación original seguirá visible en el historial:");
  if(reason===null)return;
  if(reason.trim().length<8||reason.trim().length>300){setError("Indica un motivo entre 8 y 300 caracteres.");return}
  setBusy(true);setError("");setNotice("");
  const {error}=await db().rpc("manager_reverse_transaction",{p_transaction:transaction.id,p_reason:reason.trim()});
  setBusy(false);if(error){setError(error.message);return}
  success("Movimiento revertido. El saldo del cliente y el historial se han actualizado.");await reload();
 }
 async function upload(file:File|null,field:"logo_url"|"card_background"|"stamp_image_url"){if(!file||!selected)return;
  if(file.size>5*1024*1024 || !["image/png","image/jpeg","image/webp"].includes(file.type)){setError("Solo imágenes JPG, PNG o WEBP de hasta 5 MB.");return}
  setBusy(true);setError("");const safe=file.name.toLowerCase().replace(/[^a-z0-9._-]/g,"-");
  const key=selected+"/"+Date.now()+"-"+safe;
  const {error}=await db().storage.from("business-assets").upload(key,file,{contentType:file.type,upsert:false});
  if(error){setError(error.message);setBusy(false);return}
  const {data}=db().storage.from("business-assets").getPublicUrl(key);
  await saveBusiness({[field]:data.publicUrl});setBusy(false)
 }
 async function invite(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");
  const {error}=await db().rpc("invite_staff",{p_business:selected,p_email:inviteEmail,p_role:inviteRole});
  setBusy(false);if(error){setError(error.message);return}
  setInviteEmail("");success("Invitación creada. El empleado debe registrarse con ese correo verificado e iniciar sesión para aceptarla.");await reload()
 }
 async function toggleStaff(user_id:string,active:boolean){setBusy(true);setError("");
  const {error}=await db().rpc("set_staff_active",{p_business:selected,p_user:user_id,p_active:active});
  setBusy(false);if(error){setError(error.message);return}success("Acceso actualizado.");await reload()
 }
 async function addLocation(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");
  const {error}=await db().from("business_locations").insert({business_id:selected,name:locationName,address,city,country,lat:Number(lat),lng:Number(lng)});
  setBusy(false);if(error){setError(error.message);return}setLocationName("");setAddress("");setCity("");setLat("");setLng("");success("Nueva ubicación guardada.");await reload()
 }
 async function removeLocation(id:string){if(!confirm("¿Eliminar esta ubicación?"))return;
  const {error}=await db().from("business_locations").delete().eq("id",id);
  if(error){setError(error.message);return}success("Ubicación eliminada.");await reload()
 }
 async function saveDraft(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");
  const {error}=await db().from("marketing_campaigns").insert({business_id:selected,created_by:account.user.id,subject:mailSubject,body_text:mailBody,status:"draft"});
  setBusy(false);if(error){setError(error.message);return}setMailSubject("");setMailBody("");success("Borrador guardado, sin enviar emails.");await reload()
 }
 async function sendCampaign(draft:Draft){
  if(!quote){setError("No se pudo confirmar la tarifa. Recarga la página.");return}
  if(draft.status==="draft"&&quote.contacts===0){setError("Ningún cliente ha aceptado recibir correos comerciales.");return}
  const estimate=new Intl.NumberFormat("es-MX",{style:"currency",currency:quote.currency}).format(quote.total_cents/100);
  if(!window.confirm(draft.status==="draft"?"¿Enviar esta campaña a "+quote.contacts+" contactos? Coste estimado: "+estimate+". Solo se cobra por los mensajes enviados correctamente.":"¿Continuar los envíos pendientes de esta campaña?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const resp=await fetch("/api/local/marketing/send",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({campaign_id:draft.id,expected_total_cents:quote.total_cents})});
   const value=await resp.json() as {error?:string;sent?:number;failed?:number;remaining?:number};
   if(!resp.ok||value.error)throw Error(value.error||"No se pudo enviar la campaña.");
   success("Campaña procesada: "+(value.sent||0)+" correos aceptados, "+(value.failed||0)+" fallidos y "+(value.remaining||0)+" pendientes. Solo los aceptados se contabilizan como uso.");
   await reload();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 const repeatCount=customers.filter(c=>Number(c.visits)>=2).length,canvassed=customers.filter(c=>c.marketing_ok).length;
 const programType=prog?.type;
 const formatBalance=(n:number)=>units(n,programType);
 return <div className="business-workspace">
  {manageable.length>0&&<div className="business-selector"><span>Estás gestionando</span><select value={selected} onChange={e=>{setSelected(e.target.value);setTab("overview");setNotice("")}}>{manageable.map(b=><option key={b.business_id} value={b.business_id}>{b.businesses?.name||b.business_id}</option>)}</select><ChevronDown size={16}/></div>}
  {!selected?<div className="empty-state"><Store size={33}/><h3>Todavía no gestionas ningún negocio</h3><p>El superadministrador debe crear el negocio e invitarte como responsable.</p></div>:<>
   <div className="workspace-section-layout">
    <button type="button" className="business-menu-toggle" onClick={()=>setSectionsOpen(v=>!v)} aria-expanded={sectionsOpen} aria-controls="business-section-navigation"><Menu size={21}/><span>{tabs.find(t=>t.id===tab)?.label||"Gestionar mi negocio"}</span><ChevronDown size={17}/></button>
    <aside id="business-section-navigation" className={"workspace-section-menu"+(sectionsOpen?" open":"")} aria-label="Apartados del negocio"><strong>GESTIÓN DEL NEGOCIO</strong>
     {tabs.map(t=><button type="button" key={t.id} className={tab===t.id?"active":""} aria-current={tab===t.id?"page":undefined} onClick={()=>{setTab(t.id);setSectionsOpen(false);setError("");setNotice("")}}>{t.icon}<span>{t.label}</span></button>)}
     <div className="business-nav-separator"/>
     <Link href="/negocio/facturacion"><CreditCard size={17}/> Facturación</Link>
     <Link href="/empleado"><Ticket size={17}/> Escanear tarjetas</Link>
    </aside><div className="workspace-section-body">
   {error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success"><Check size={17}/>{notice}</div>}
   {loading&&!biz?<div className="soft-panel">Cargando negocio...</div>:biz&&prog&&<>
   {tab==="overview"&&<><div className="kpi-grid"><KPI icon={<Users/>} theme="green" title="Clientes registrados" value={customers.length} helper="Tarjetas emitidas"/><KPI icon={<Activity/>} theme="peach" title="Visitas registradas" value={customers.reduce((a,c)=>a+Number(c.visits),0)} helper="Compras manualmente verificadas"/><KPI icon={<Gift/>} theme="purple" title="Recompensas canjeadas" value={transactions.filter(t=>t.kind==="redeem").length} helper="Últimas 250 operaciones"/><KPI icon={<BarChart3/>} theme="pink" title="Clientes recurrentes" value={customers.length?Math.round(repeatCount/customers.length*100)+"%":"0%"} helper="2 o más compras registradas"/></div>
    <div className="demo-two-cols"><section className="panel-card"><h2>Últimos movimientos</h2><p className="muted">Cada visita es una oportunidad para fidelizar.</p>{transactions.slice(0,6).map(t=><div className="activity-row" key={t.id}><div className={"activity-icon "+(t.kind==="earn"?"positive":"negative")}>{t.kind==="earn"?<Plus size={18}/>:<Gift size={18}/>}</div><div><strong>{t.kind==="earn"?"Compra verificada":"Recompensa canjeada"}</strong><span>{dateShort(t.created_at)} {t.ticket_ref?"· Ticket "+t.ticket_ref:""}</span></div><b className={t.amount_delta>0?"positive-text":"negative-text"}>{t.amount_delta>0?"+":""}{formatBalance(t.amount_delta)}</b></div>)}{transactions.length===0&&<p className="muted">Todavía no se han registrado movimientos.</p>}</section>
    <section className="panel-card overview-card"><div className="panel-icon"><Gift size={23}/></div><h2>Tu programa en una mirada</h2><p className="muted">Recompensas que hablan de tu negocio.</p><div className="overview-stat"><span>Modalidad</span><strong>{programType==="stamps"?"Sellos":programType==="points"?"Puntos":"Saldo a favor"}</strong></div><div className="overview-stat"><span>Recompensa</span><strong>{prog.reward_label}</strong></div><div className="overview-stat"><span>Clientes con consentimiento comercial</span><strong>{canvassed}</strong></div><a className="button button-outline button-full" href={"/unirse/"+biz.slug} target="_blank" rel="noreferrer">Ver enlace de inscripción <ArrowUpRight size={16}/></a><Link href="/negocio/facturacion" className="button button-outline button-full">Facturación y suscripción <CreditCard size={16}/></Link><button className="button button-outline button-full" onClick={()=>setTab("program")}>Configurar programa <ArrowUpRight size={16}/></button></section></div>
   </>}
   {tab==="settings"&&<div className="settings-grid"><form className="panel-card" onSubmit={e=>{e.preventDefault();saveBusiness({name:biz.name,description:biz.description,category:biz.category,public_listing:biz.public_listing})}}><div className="panel-icon"><Settings2 size={22}/></div><h2>Información del negocio</h2><p className="muted">Así te descubrirán tus clientes.</p><div className="form-stack"><label>Nombre comercial<input required value={biz.name} onChange={e=>setBiz({...biz,name:e.target.value})}/></label><label>¿Qué tipo de negocio tienes?<select value={biz.category||""} onChange={e=>setBiz({...biz,category:e.target.value})}><option value="">Seleccionar</option>{BUSINESS_CATEGORIES.map(v=><option key={v.name}>{v.name}</option>)}</select></label><div className="business-category-preview"><StampMark kind={categoryStampKind(biz.category)} size={28}/><span>Este dibujo identificará a tu negocio en el mapa y se elige automáticamente según su categoría.</span></div><label>Descripción<textarea rows={5} maxLength={500} value={biz.description||""} onChange={e=>setBiz({...biz,description:e.target.value})} placeholder="Cuéntales a tus clientes qué hace especial a tu negocio..."/></label><div className="check-control"><input id="public-listing" type="checkbox" checked={biz.public_listing} onChange={e=>setBiz({...biz,public_listing:e.target.checked})}/><label htmlFor="public-listing"><strong>Aparecer en el directorio público</strong><small>Tu negocio podrá descubrirse en el mapa cuando tenga una ubicación.</small></label></div><button className="button button-dark" disabled={busy}>Guardar cambios</button></div></form><section className="panel-card"><h2>Tu identidad de marca</h2><p className="muted">Sube un logo para personalizar la tarjeta y la ficha de tu negocio.</p><div className="upload-preview">{biz.logo_url?<img src={biz.logo_url} alt="Logo del negocio"/>:<div className="upload-logo" style={{background:biz.accent_color}}>{initials(biz.name)}</div>}</div><label className="file-input"><ImagePlus size={18}/> Subir logotipo <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files?.[0]||null,"logo_url")}/></label><div className="info-callout"><ShieldCheck size={18}/> Puedes usar una imagen de hasta 5 MB. Tu logotipo se mostrará a quienes descubran el negocio y guarden su tarjeta.</div></section></div>}

   {tab==="designer"&&<div className="designer-grid lp-new-designer">
    <section className="panel-card"><div className="panel-icon"><Brush size={22}/></div><h2>Diseña tu tarjeta</h2><p className="muted">Personaliza los sellos y sus colores. Tus clientes verán los cambios en sus tarjetas.</p>
     <div className="form-stack">
      <label>Mensaje en la tarjeta<input value={biz.card_text||""} maxLength={60} placeholder="GRACIAS POR VOLVER" onChange={e=>setBiz({...biz,card_text:e.target.value})}/></label>
      <label>Nombre de la recompensa<input value={prog.reward_label} maxLength={150} onChange={e=>setProg({...prog,reward_label:e.target.value})}/></label>
      {prog.type==="stamps"&&<div className="form-two"><label>Sellos necesarios<input type="number" min={2} max={30} value={prog.reward_cost} onChange={e=>setProg({...prog,reward_cost:Math.min(30,Math.max(2,Number(e.target.value)||2))})}/></label><label>Máximo por compra<input type="number" min={1} max={100} value={prog.max_stamps_per_action} onChange={e=>setProg({...prog,max_stamps_per_action:Math.min(100,Math.max(1,Number(e.target.value)||1))})}/></label></div>}
      <label className="color-input-label">Fondo de la tarjeta <span><input aria-label="Elegir color de fondo" type="color" value={biz.accent_color} onChange={e=>setBiz({...biz,accent_color:e.target.value})}/><code>{biz.accent_color}</code></span></label>
      <div className="preset-palette">{COLOR_PRESETS.map(color=><button type="button" title={color} aria-label={"Elegir color "+color} onClick={()=>setBiz({...biz,accent_color:color})} style={{background:color}} key={color}/>)}</div>
      <div className="form-two"><label className="color-input-label">Color de las letras <span><input type="color" value={biz.card_text_color||"#ffffff"} onChange={e=>setBiz({...biz,card_text_color:e.target.value})}/><code>{biz.card_text_color||"#ffffff"}</code></span></label><label className="color-input-label">Color de los sellos <span><input type="color" value={biz.stamp_color||"#275642"} onChange={e=>setBiz({...biz,stamp_color:e.target.value})}/><code>{biz.stamp_color||"#275642"}</code></span></label></div>
      {prog.type==="stamps"&&<>
       <strong className="lp-icon-heading">Selecciona el dibujo de los sellos</strong>
       <div className="role-demo-icon-grid lp-real-icon-grid">{STAMP_OPTIONS.map(option=><button type="button" key={option.id} className={(biz.stamp_icon||"coffee")===option.id&&!biz.stamp_image_url?"selected":""} aria-label={"Sello de "+option.label} aria-pressed={(biz.stamp_icon||"coffee")===option.id&&!biz.stamp_image_url} onClick={()=>setBiz({...biz,stamp_icon:option.id,stamp_image_url:null})}><StampMark kind={option.id} size={28}/><span>{option.label}</span></button>)}</div>
       <label className="file-input"><ImagePlus size={18}/> Subir sello propio <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files?.[0]||null,"stamp_image_url")}/></label>
       {biz.stamp_image_url&&<button type="button" className="role-demo-textbutton" onClick={()=>setBiz({...biz,stamp_image_url:null})}>Quitar imagen personalizada</button>}
       <small className="muted">Elige uno de nuestros dibujos o, si lo prefieres, sube tu propia imagen. Todos tus clientes verán el sello que hayas elegido.</small>
      </>}
      <label className="file-input"><ImagePlus size={18}/> Subir imagen de fondo <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files?.[0]||null,"card_background")}/></label>{biz.card_background&&<button type="button" className="role-demo-textbutton" onClick={()=>saveBusiness({card_background:null})}>Quitar imagen de fondo</button>}
      <button className="button button-dark button-full" disabled={busy} type="button" onClick={saveDesigner}>{busy?"Guardando...":"Guardar diseño y sellos"} <Check size={17}/></button>
     </div>
    </section>
    <section className="panel-card designer-preview-wrap lp-designer-live">
     <span className="eyebrow">VISTA PREVIA EN DIRECTO</span>
     {prog.type==="stamps"?<StampCard name={biz.name} color={biz.accent_color} textColor={biz.card_text_color} stampColor={biz.stamp_color} reward={prog.reward_label} total={prog.type==="stamps"?prog.reward_cost:8} earned={Math.min(previewEarned,prog.type==="stamps"?prog.reward_cost:8)} icon={biz.stamp_icon} imageUrl={biz.stamp_image_url} logoUrl={biz.logo_url} backgroundUrl={biz.card_background} message={biz.card_text} qrValue={(siteOrigin||process.env.NEXT_PUBLIC_SITE_URL||"")+"/unirse/"+biz.slug}/>:<div className="lp-other-program-preview" style={{backgroundColor:biz.accent_color,color:biz.card_text_color||"#ffffff"}}><span>{biz.card_text||"GRACIAS POR VOLVER"}</span><h3>{biz.name}</h3><strong>{prog.type==="points"?"Programa de puntos":"Programa de saldo a favor"}</strong><p>{prog.reward_label}</p></div>}
     {prog.type==="stamps"&&<label className="lp-preview-range">Sellos en la vista previa: <strong>{Math.min(previewEarned,prog.reward_cost)} de {prog.reward_cost}</strong><input type="range" min={0} max={prog.reward_cost} value={Math.min(previewEarned,prog.reward_cost)} onChange={e=>setPreviewEarned(Number(e.target.value))}/></label>}
     <p className="tiny-note">Los huecos vacíos son blancos. Cada sello ganado utiliza el icono elegido. Comparte el enlace de inscripción con tus clientes. Cada tarjeta tendrá su propio código para registrar las visitas.</p>
     <a className="button button-outline button-full" href={"/unirse/"+biz.slug} target="_blank" rel="noreferrer">Ver página de inscripción <ArrowUpRight size={17}/></a>
    </section>
   </div>}
   {tab==="program"&&<form className="panel-card program-form" onSubmit={saveProgram}><div className="panel-icon"><Gift size={22}/></div><h2>Tu programa de fidelización</h2><p className="muted">Elige cómo recompensar. Para evitar confusiones, configura la modalidad antes de que haya clientes inscritos.</p><div className="program-type-grid">{([{id:"stamps",label:"Sellos",desc:"Cada compra suma sellos",icon:<Ticket/>},{id:"points",label:"Puntos",desc:"Puntos por importe gastado",icon:<StarIcon/>},{id:"cashback",label:"Saldo a favor",desc:"Recupera parte de tus compras",icon:<Wallet/>}] as const).map(x=><button type="button" key={x.id} className={"program-type"+(prog.type===x.id?" selected":"")} disabled={customers.length>0&&prog.type!==x.id} onClick={()=>setProg({...prog,type:x.id})}><span>{x.icon}</span><strong>{x.label}</strong><small>{x.desc}</small></button>)}</div><div className="form-stack">
   <label>Nombre de la recompensa<input value={prog.reward_label} required onChange={e=>setProg({...prog,reward_label:e.target.value})} placeholder="Café gratis"/></label>
   {prog.type==="stamps"&&<div className="form-two"><label>Sellos necesarios para canjear<input type="number" min={1} value={prog.reward_cost} onChange={e=>setProg({...prog,reward_cost:Number(e.target.value)})}/></label><label>Máx. sellos por operación<input type="number" min={1} max={100} value={prog.max_stamps_per_action} onChange={e=>setProg({...prog,max_stamps_per_action:Number(e.target.value)})}/></label></div>}
   {prog.type==="points"&&<div className="form-two"><label>Puntos por cada peso (MXN)<input type="number" min={0.01} max={100} step=".01" value={prog.points_per_euro} onChange={e=>setProg({...prog,points_per_euro:Number(e.target.value)})}/></label><label>Puntos para canjear<input type="number" min={1} value={prog.reward_cost} onChange={e=>setProg({...prog,reward_cost:Number(e.target.value)})}/></label></div>}
   {prog.type==="cashback"&&<label>Porcentaje que vuelve como saldo<input type="number" min={0.01} max={100} step=".01" value={prog.cashback_bps/100} onChange={e=>setProg({...prog,cashback_bps:Math.round(Number(e.target.value)*100)})}/><small>El saldo que gana el cliente se calcula automáticamente en cada compra.</small></label>}
   <div className="form-two"><label>Máximo importe por ticket (MXN)<input type="number" min={1} step=".01" value={prog.max_ticket_cents/100} onChange={e=>setProg({...prog,max_ticket_cents:Math.round(Number(e.target.value)*100)})}/></label><label>Espera mínima entre compras (segundos)<input type="number" min={0} max={86400} value={prog.min_seconds_between_awards} onChange={e=>setProg({...prog,min_seconds_between_awards:Number(e.target.value)})}/></label></div>
   <div className="form-two"><label>Máx. compras por empleado al día<input type="number" min={1} max={250} value={prog.max_daily_awards_per_employee} onChange={e=>setProg({...prog,max_daily_awards_per_employee:Number(e.target.value)})}/></label>
   <div className="check-control"><input id="require-ticket" type="checkbox" checked={prog.require_ticket_reference} onChange={e=>setProg({...prog,require_ticket_reference:e.target.checked})}/><label htmlFor="require-ticket"><strong>Exigir referencia de ticket</strong><small>Evita reutilizar el mismo identificador de venta dentro del negocio.</small></label></div></div>
   <div className="info-callout"><ShieldCheck size={18}/> Cada visita queda registrada con la fecha y el empleado que la atendió, para que puedas consultar el historial y corregir errores.</div>
   <button disabled={busy} className="button button-dark">Guardar programa <Check size={17}/></button></div></form>}
   {tab==="team"&&<div className="admin-grid"><section className="panel-card"><h2>Tu equipo</h2><p className="muted">Cada empleado opera bajo su cuenta y queda registrado en cada movimiento.</p>{staff.map(x=><div className="activity-row team-row" key={x.user_id}><div className="person-initial">{initials(x.full_name||x.email)}</div><div><strong>{x.full_name||x.email}</strong><span>{x.email} · {x.role==="owner"?"Propietario":x.role==="manager"?"Manager":"Empleado"}</span></div>{x.role!=="owner"&&<button disabled={busy} onClick={()=>toggleStaff(x.user_id,!x.active)} className={"table-pill "+(x.active?"":"inactive")}>{x.active?"Activo":"Inactivo"}</button>}</div>)}<h3 className="subheading">Invitaciones pendientes</h3>{invites.map(x=><div className="activity-row" key={x.id}><div className="activity-icon positive"><Mail size={17}/></div><div><strong>{x.email}</strong><span>{x.role} · Pendiente de registro/verificación</span></div></div>)}{!invites.length&&<p className="muted">No hay invitaciones pendientes.</p>}</section>
   <form className="panel-card" onSubmit={invite}><div className="panel-icon"><Users size={22}/></div><h2>Añadir un empleado</h2><p className="muted">Invita por email. La cuenta tendrá acceso solo a los negocios asignados.</p><div className="form-stack"><label>Email del empleado<input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="empleado@negocio.com" required/></label><label>Permiso<select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}><option value="employee">Empleado: escanear y canjear</option>{account.businesses.find(x=>x.business_id===selected)?.role==="owner"&&<option value="manager">Manager: también gestionar negocio</option>}</select></label><button className="button button-dark" disabled={busy}>Crear invitación <Plus size={17}/></button></div><p className="tiny-note">La invitación queda registrada en Loyally. No se envía un email automáticamente hasta integrar un servicio transaccional; puedes avisar al empleado por tu cuenta.</p></form></div>}
   {tab==="customers"&&<section className="panel-card"><div className="content-heading"><div><h2>Tu comunidad</h2><p>Solo clientes inscritos en tu programa.</p></div><span className="table-pill">{customers.length} clientes</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Email</th><th>Saldo</th><th>Visitas</th><th>Marketing</th><th>Alta</th></tr></thead><tbody>{customers.map(x=><tr key={x.user_id}><td><strong>{x.full_name||"Sin nombre"}</strong></td><td>{x.email}</td><td><b>{formatBalance(x.balance)}</b></td><td>{x.visits}</td><td>{x.marketing_ok?<span className="table-pill">Aceptado</span>:<span className="table-pill inactive">No</span>}</td><td>{dateShort(x.joined_at)}</td></tr>)}</tbody></table></div>{customers.length===0&&<p className="muted">Comparte tu programa para conseguir tus primeros clientes.</p>}</section>}
   {tab==="locations"&&<div className="admin-grid"><section className="panel-card"><h2>Locales y sucursales</h2><p className="muted">Los clientes encontrarán tus locales en el mapa cuando actives la opción de aparecer en el directorio.</p>{locations.map(l=><div className="activity-row" key={l.id}><div className="activity-icon positive"><MapPin size={19}/></div><div><strong>{l.name}</strong><span>{l.address}, {l.city}, {l.country}</span><small className="muted">Lat. {l.lat}, lng. {l.lng}</small></div><button className="icon-button" aria-label="Eliminar ubicación" onClick={()=>removeLocation(l.id)}><Trash2 size={18}/></button></div>)}{!locations.length&&<p className="muted">Añade una ubicación para aparecer en el directorio.</p>}</section><form className="panel-card" onSubmit={addLocation}><div className="panel-icon"><MapPin size={22}/></div><h2>Añadir ubicación</h2><p className="muted">Completa la dirección de tu local. Para marcar su posición exacta en el mapa puedes usar la ubicación de tu dispositivo estando allí.</p><div className="form-stack"><label>Nombre del local<input required value={locationName} onChange={e=>setLocationName(e.target.value)} placeholder="Local principal"/></label><label>Dirección<input required value={address} onChange={e=>setAddress(e.target.value)} placeholder="Calle y número"/></label><div className="form-two"><label>Ciudad<input required value={city} onChange={e=>setCity(e.target.value)}/></label><label>País<input required value={country} onChange={e=>setCountry(e.target.value)}/></label></div><div className="form-two"><label>Posición norte/sur (latitud)<input required type="number" min={-90} max={90} step="any" value={lat} onChange={e=>setLat(e.target.value)}/></label><label>Posición este/oeste (longitud)<input required type="number" min={-180} max={180} step="any" value={lng} onChange={e=>setLng(e.target.value)}/></label></div><button className="button button-dark" disabled={busy}>Guardar local <Plus size={16}/></button></div></form></div>}
   {tab==="reports"&&<>
   <div className="kpi-grid three">
     <KPI icon={<Users/>} theme="green" title="Clientes únicos" value={customers.length} helper="Inscritos"/>
     <KPI icon={<Activity/>} theme="peach" title="Recurrentes" value={repeatCount} helper="Con al menos 2 compras"/>
     <KPI icon={<Gift/>} theme="purple" title="Canjes registrados" value={transactions.filter(t=>t.kind==="redeem").length} helper="Últimas 250 operaciones"/>
   </div>
   <div className="panel-card"><h2>Actividad por empleado · últimos 30 días</h2>
    <p className="muted">Total de operaciones de compra verificadas manualmente. Los reembolsos se detallan en el historial.</p>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Empleado</th><th>Compras registradas</th><th>Unidades asignadas</th></tr></thead>
    <tbody>{activity.map(a=><tr key={a.user_id}><td><strong>{a.employee_name}</strong></td><td>{a.operations}</td><td>{a.awarded_units}</td></tr>)}</tbody></table></div>
    {activity.length===0&&<p className="muted">Todavía no hay compras registradas por el equipo.</p>}
   </div>
   <div className="panel-card" style={{marginTop:20}}><h2>Historial y correcciones</h2>
    <p className="muted">Últimas 250 operaciones. Un responsable puede revertir movimientos de las últimas 72 horas, siempre que el saldo lo permita. No se borran los registros originales.</p>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Acción</th><th>Unidades</th><th>Ticket</th><th>Compra</th><th>Empleado</th><th>Acción</th></tr></thead>
    <tbody>{transactions.map(t=>{
      const reversed=transactions.some(v=>v.reversal_of===t.id);
      const actor=staff.find(s=>s.user_id===t.employee_id);
      return <tr key={t.id}>
        <td>{dateShort(t.created_at)}</td>
        <td>{t.kind==="earn"?"Compra":t.kind==="redeem"?"Canje":"Corrección"}{reversed?" · Revertida":""}</td>
        <td><b>{t.amount_delta>0?"+":""}{formatBalance(t.amount_delta)}</b></td>
        <td>{t.ticket_ref||"—"}</td>
        <td>{t.purchase_cents==null?"—":(t.purchase_cents/100).toFixed(2)+" €"}</td>
        <td>{actor?.full_name||actor?.email||"—"}</td>
        <td>{t.kind!=="reversal"&&!reversed?
         <button type="button" disabled={busy||new Date(t.created_at).getTime()<Date.now()-72*60*60*1000} className="inline-table-button" onClick={()=>reverseTransaction(t)}>Revertir</button>:
         <span title={t.reversal_reason||"Movimiento ya corregido"} className="table-pill inactive">{t.kind==="reversal"?"Registrado":"Corregido"}</span>}</td>
      </tr>})}</tbody></table></div>
   </div>
 </>}
   {tab==="marketing"&&<div className="admin-grid"><form className="panel-card" onSubmit={saveDraft}><div className="panel-icon"><Mail size={22}/></div><h2>Tu próxima campaña</h2><p className="muted">Prepara un correo para clientes que hayan aceptado recibir campañas. Las direcciones se mantienen protegidas por Loyally.</p><div className="marketing-eligible"><Mail size={19}/><div><strong>{quote?.contacts??canvassed} destinatarios autorizados</strong><small>{quote?new Intl.NumberFormat("es-MX",{style:"currency",currency:quote.currency}).format(quote.total_cents/100)+" estimados · "+quote.price_cents+" centavos/contacto":"Calculando presupuesto en el servidor..."} · De {customers.length} clientes</small></div></div><div className="form-stack"><label>Asunto<input value={mailSubject} required maxLength={180} onChange={e=>setMailSubject(e.target.value)} placeholder="¡Esta semana hay algo especial!"/></label><label>Mensaje<textarea value={mailBody} required rows={9} onChange={e=>setMailBody(e.target.value)} placeholder="Hola, queremos contarte..."/></label><button className="button button-dark" disabled={busy}>Guardar borrador <FileText size={17}/></button></div><p className="tiny-note">Guardar un borrador no envía ni cobra. Para enviar mensajes, el servicio de correo debe estar activo. Solo se contabilizan los correos aceptados por SMTP; las bajas se gestionan mediante un enlace individual.</p></form><section className="panel-card"><h2>Borradores del negocio</h2>{drafts.map(d=><div className="activity-row" key={d.id}><div className="activity-icon positive"><Mail size={18}/></div><div><strong>{d.subject}</strong><span>{dateShort(d.created_at)} · {d.status==="draft"?"Borrador":d.status==="sent"?"Envío terminado":d.status==="partial"?"Envío parcial":d.status==="failed"?"Envío fallido":"En proceso"}{d.status!=="draft"?" · "+(d.sent_count||0)+" correos enviados":""}</span></div>{!demoRole()&&(["draft","queued","sending"].includes(d.status))&&<button type="button" className="button button-outline button-sm" disabled={busy||(d.status==="draft"&&(!quote||quote.contacts===0))} onClick={()=>sendCampaign(d)}>{d.status==="draft"?"Enviar campaña":"Continuar envío"}</button>}</div>)}{!drafts.length&&<p className="muted">Todavía no hay borradores.</p>}</section></div>}
   </>}
  </div></div></>}
 </div>;
}
function KPI({icon,theme,title,value,helper}:{icon:React.ReactNode;theme:string;title:string;value:string|number;helper:string}){return <div className="kpi-card"><div className={"kpi-symbol "+theme}>{icon}</div><span>{title}</span><strong>{value}</strong><small>{helper}</small></div>}
function StarIcon(){return <span style={{fontSize:24,lineHeight:1}}>✦</span>}
