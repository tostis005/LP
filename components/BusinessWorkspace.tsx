"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {AddressPicker} from "@/components/AddressPicker";
import {usePathname,useRouter} from "next/navigation";
import {Activity,ArrowUpRight,BarChart3,Brush,Check,ChevronDown,CircleHelp,Clock3,CreditCard,FileText,Gift,ImagePlus,MapPin,Mail,BellRing,Menu,Plus,Settings2,ShieldCheck,Store,Ticket,ToggleLeft,Trash2,Users,Wallet} from "lucide-react";
import type {Account} from "@/components/AppFrame";
import type {Business,Program,Location} from "@/lib/types";
import {dateShort,initials,units} from "@/lib/format";
import {displayCurrency} from "@/lib/currency";
import {db} from "@/lib/supabase";
import {showActionToast} from "@/lib/action-toast";
import {STAMP_OPTIONS,StampMark} from "@/components/StampMarks";
import {StampCard} from "@/components/StampCard";
import {BUSINESS_CATEGORIES,categoryStampKind} from "@/lib/business-categories";
import {BusinessAnalytics,type MetricRow,type RankingRow} from "@/components/BusinessAnalytics";
import {RewardCatalog,type RewardOption} from "@/components/RewardCatalog";
import {RichMessageEditor} from "@/components/RichMessageEditor";
type Tab="overview"|"card"|"settings"|"designer"|"program"|"team"|"customers"|"locations"|"reports"|"marketing";
type CardArea="design"|"rules"|"rewards";
const tabs:{id:Tab;label:string;icon:React.ReactNode}[]=[
 {id:"overview",label:"Resumen",icon:<BarChart3 size={17}/>},
 {id:"card",label:"Mi tarjeta",icon:<CreditCard size={17}/>},
 {id:"settings",label:"Negocio",icon:<Store size={17}/>},
 {id:"designer",label:"Diseñar mi tarjeta",icon:<Brush size={17}/>},
 {id:"program",label:"Premios y sellos",icon:<Gift size={17}/>},
 {id:"team",label:"Empleados",icon:<Users size={17}/>},
 {id:"customers",label:"Clientes",icon:<CreditCard size={17}/>},
 {id:"locations",label:"Ubicaciones",icon:<MapPin size={17}/>},
 {id:"reports",label:"Indicadores",icon:<Activity size={17}/>},
 {id:"marketing",label:"Mensajes y ofertas",icon:<Mail size={17}/>}
];
type Customer={user_id:string;full_name:string;email:string;balance:number;total_earned:number;visits:number;marketing_ok:boolean;joined_at:string};
type Employee={user_id:string;full_name:string;email:string;role:string;active:boolean};
type Tx={id:string;kind:"earn"|"redeem"|"reversal";amount_delta:number;purchase_cents:number|null;ticket_ref:string|null;created_at:string;membership_id:string;employee_id:string|null;reversal_of:string|null;reversal_reason:string|null};
type Draft={id:string;subject:string;body_text:string;channel:"email"|"whatsapp"|"push";template_name?:string|null;template_language?:string|null;created_at:string;status:string;recipient_count?:number;sent_count?:number;failed_count?:number};
type MailQuote={contacts:number;price_cents:number|null;total_cents:number|null;currency:string};
type Usage={channel:"email"|"whatsapp";messages:number;amount_cents:number;currency:string};
type MarketingStatus={email:boolean;whatsapp:boolean;push:boolean;template_name:string;template_language:string};
function privateEmail(value:string){
 if(!value||!value.includes("@"))return "Oculto";
 const [left,right]=value.split("@");
 if(left.includes("*")||right.includes("*")||left.includes("X")&&left.length<4)return value.replace(/\*/g,"X");
 return (left.slice(0,Math.min(2,left.length))+"X".repeat(Math.max(3,left.length-2))+"@"+right.slice(0,1)+"X".repeat(Math.max(3,right.length-1)));
}

const COLOR_PRESETS=["#571c32","#351623","#8b3c58","#a7637c","#7760a5","#c9784f","#273550","#a14460","#1d1d1d","#367666","#a35f75","#2c73ac","#dfac5c","#b33c3c","#134e4a","#6d28d9","#f97316","#0f172a","#edf4e9","#f4e8db","#f9cadf","#ffffff","#000000"];
const STAMP_COLOR_PRESETS=["#571c32","#8b3c58","#0f172a","#2563eb","#b91c1c","#c2410c","#7c3aed","#0f766e","#a16207","#db2777","#ffffff"];
export default function BusinessWorkspace({account}:{account:Account}){
 const router=useRouter(),pathname=usePathname();
 const manageable=account.businesses.filter(b=>b.role!=="employee");
 const [selected,setSelected]=useState(manageable[0]?.business_id||"");
 const section=pathname.split("/")[2];
 const tab:Tab=section==="designer"||section==="program"?"card":tabs.find(t=>t.id===section)?.id||"overview";
 const [cardArea,setCardArea]=useState<CardArea>(section==="program"?"rules":"design");
 function openSection(next:Tab){
  if(next==="designer"||next==="program"||next==="card"){
   setCardArea(next==="program"?"rules":"design");router.push("/negocio/tarjeta");
  }else router.push(next==="overview"?"/negocio":"/negocio/"+next);
  setError("");setNotice("");
 }
 useEffect(()=>{try{const stored=window.sessionStorage.getItem("loyally_selected_business");if(stored&&manageable.some(b=>b.business_id===stored))setSelected(stored);}catch{}},[account.user.id]);
 const [biz,setBiz]=useState<Business|null>(null),[prog,setProg]=useState<Program|null>(null),[customers,setCustomers]=useState<Customer[]>([]),[staff,setStaff]=useState<Employee[]>([]),[invites,setInvites]=useState<{id:string;email:string;role:string;created_at:string}[]>([]),[locations,setLocations]=useState<Location[]>([]),[transactions,setTransactions]=useState<Tx[]>([]),[drafts,setDrafts]=useState<Draft[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [periodDays,setPeriodDays]=useState(30),[metrics,setMetrics]=useState<MetricRow[]>([]),[ranking,setRanking]=useState<RankingRow[]>([]),[rewardOptions,setRewardOptions]=useState<RewardOption[]>([]);
 const [activity,setActivity]=useState<{user_id:string;employee_name:string;operations:number;awarded_units:number}[]>([]);
 const [inviteEmail,setInviteEmail]=useState(""),[inviteRole,setInviteRole]=useState("employee"),[teamView,setTeamView]=useState<"list"|"invite">("list");
 const [locationName,setLocationName]=useState(""),[address,setAddress]=useState(""),[city,setCity]=useState("Tijuana"),[country,setCountry]=useState("México"),[lat,setLat]=useState(""),[lng,setLng]=useState("");
 const [mailSubject,setMailSubject]=useState(""),[mailBody,setMailBody]=useState(""),[quote,setQuote]=useState<MailQuote|null>(null);
 const [marketingChannel,setMarketingChannel]=useState<"email"|"whatsapp"|"push">("email"),[editingDraft,setEditingDraft]=useState<string|null>(null),[campaignView,setCampaignView]=useState<"list"|"editor">("list");
 const [usage,setUsage]=useState<Usage[]>([]),[marketingStatus,setMarketingStatus]=useState<MarketingStatus>({email:false,whatsapp:false,push:false,template_name:"",template_language:""});
 useEffect(()=>{fetch("/api/local/marketing/status",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(v=>{if(v)setMarketingStatus(v as MarketingStatus)}).catch(()=>{});},[]);
 const [previewEarned,setPreviewEarned]=useState(3),[siteOrigin,setSiteOrigin]=useState("");
 useEffect(()=>{setSiteOrigin(window.location.origin)},[]);
 const reload=useCallback(async()=>{
  if(!selected)return;setLoading(true);setError("");
  const [b,p,c,s,i,l,t,d,a,m,r,o]=await Promise.all([
   db().from("businesses").select("*").eq("id",selected).maybeSingle(),
   db().from("loyalty_programs").select("*").eq("business_id",selected).maybeSingle(),
   db().rpc("business_customer_directory",{p_business:selected}),
   db().rpc("business_staff_directory",{p_business:selected}),
   db().from("business_invitations").select("id,email,role,created_at").eq("business_id",selected).is("claimed_at",null),
   db().from("business_locations").select("*").eq("business_id",selected),
   db().from("loyalty_transactions").select("id,kind,amount_delta,purchase_cents,ticket_ref,created_at,membership_id,employee_id,reversal_of,reversal_reason").eq("business_id",selected).order("created_at",{ascending:false}).limit(250),
   db().from("marketing_campaigns").select("id,subject,body_text,channel,template_name,template_language,status,recipient_count,sent_count,failed_count,created_at").eq("business_id",selected).order("created_at",{ascending:false}),
   db().rpc("business_employee_activity",{p_business:selected,p_days:30}),
    db().rpc("business_dashboard_metrics",{p_business:selected,p_days:periodDays}),
    db().rpc("business_reward_ranking",{p_business:selected,p_days:periodDays}),
    db().from("reward_options").select("*").eq("business_id",selected).order("position",{ascending:true})
  ]);
  setBiz(b.data as Business|null);setProg(p.data as Program|null);setCustomers((c.data||[]) as Customer[]);
  setStaff((s.data||[]) as Employee[]);setInvites(i.data||[]);setLocations((l.data||[]) as Location[]);
  const firstLocation=(l.data||[])[0] as Location|undefined;
  if(firstLocation){setLocationName(firstLocation.name);setAddress(firstLocation.address);setCity(firstLocation.city);setCountry(firstLocation.country);setLat(String(firstLocation.lat));setLng(String(firstLocation.lng))}
  else {setLocationName("");setAddress("");setLat("");setLng("")}
  setTransactions((t.data||[]) as Tx[]);setActivity((a.data||[]) as {user_id:string;employee_name:string;operations:number;awarded_units:number}[]);
   setMetrics((m.data||[]) as MetricRow[]);setRanking((r.data||[]) as RankingRow[]);setRewardOptions((o.data||[]) as RewardOption[]);
  const failure=b.error||p.error||c.error||s.error||i.error||l.error||t.error||d.error||a.error||m.error||r.error||o.error;
  if(failure)setError(failure.message);
  const [pricing,used,pushItems]=await Promise.all([
   db().rpc(marketingChannel==="email"?"business_mail_quote":marketingChannel==="whatsapp"?"business_whatsapp_quote":"business_push_pricing",{p_business:selected}),
   db().rpc("business_marketing_usage",{p_business:selected}),
   db().rpc("business_push_campaigns_unified",{p_business:selected})
  ]);
  const priceInfo=(pricing.data||[])[0] as (MailQuote&{devices?:number})|undefined;
  setQuote(pricing.error||!priceInfo?null:{contacts:marketingChannel==="push"?Number(priceInfo.devices||0):Number(priceInfo.contacts||0),
   price_cents:priceInfo.price_cents,total_cents:priceInfo.total_cents,currency:priceInfo.currency});
  setUsage((used.data||[]) as Usage[]);
  setDrafts([...(d.data||[]) as Draft[],...(pushItems.data||[]) as Draft[]]
   .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)));
  if(pushItems.error)setError(pushItems.error.message);
  setLoading(false);
 },[selected,periodDays,marketingChannel]);
 useEffect(()=>{reload()},[reload]);
 function success(s:string){setNotice(s);setError("");showActionToast(s)}
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
   card_text_color:biz.card_text_color||"#ffffff",stamp_color:biz.stamp_color||"#571c32",
   stamp_icon:biz.stamp_icon||"coffee",stamp_image_url:biz.stamp_image_url||null
  }).eq("id",selected);
  if(visualError){setBusy(false);setError(visualError.message);return}
  setBusy(false);success("Diseño de tarjeta guardado.");await reload();
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
  setInviteEmail("");setTeamView("list");success("Invitación creada. El empleado debe registrarse con ese correo verificado e iniciar sesión para aceptarla.");await reload()
 }
 async function toggleStaff(user_id:string,active:boolean){setBusy(true);setError("");
  const {error}=await db().rpc("set_staff_active",{p_business:selected,p_user:user_id,p_active:active});
  setBusy(false);if(error){setError(error.message);return}success("Acceso actualizado.");await reload()
 }
 async function saveLocation(e:React.FormEvent){
  e.preventDefault();setError("");setNotice("");
  const location=locations[0];
  if(!lat||!lng){setError("Marca la posición de tu local en el mapa.");return}
  if(!location){setError("Kreyv tiene que activar primero la dirección de este establecimiento.");return;}
  setBusy(true);
  const {error}=await db().from("business_locations").update({
   name:locationName,address,city,country,lat:Number(lat),lng:Number(lng)
  }).eq("id",location.id).eq("business_id",selected);
  setBusy(false);
  if(error){setError(error.message);return}
  success("Dirección actualizada.");await reload();
 }
 function editDraft(d:Draft){setEditingDraft(d.id);setMarketingChannel(d.channel||"email");setMailSubject(d.subject);setMailBody(d.body_text);setCampaignView("editor");setError("");setNotice("");}
 function clearComposer(){setEditingDraft(null);setMailSubject("");setMailBody("");setCampaignView("list");}
 async function saveDraft(e:React.FormEvent){
  e.preventDefault();setError("");setNotice("");
  const max=marketingChannel==="push"?500:marketingChannel==="whatsapp"?900:12000;
  if(mailBody.trim().length<3||mailBody.length>max){setError("Revisa la longitud del mensaje.");return;}
  if(marketingChannel==="push"&&mailSubject.length>120){setError("El título debe tener hasta 120 caracteres.");return;}
  setBusy(true);
  let error:Error|null=null;
  if(marketingChannel==="push"){
   const r=await db().rpc("business_save_push_campaign",{p_business:selected,p_title:mailSubject.trim(),
    p_body:mailBody.trim(),p_campaign:editingDraft||null});
   error=r.error;
  }else{
   const fields={subject:mailSubject.trim(),body_text:mailBody,channel:marketingChannel,
    template_name:marketingChannel==="whatsapp"?(marketingStatus.template_name||null):null,
    template_language:marketingChannel==="whatsapp"?(marketingStatus.template_language||null):null};
   const r=editingDraft?await db().from("marketing_campaigns").update(fields).eq("id",editingDraft).eq("business_id",selected).eq("status","draft"):
    await db().from("marketing_campaigns").insert({...fields,business_id:selected,created_by:account.user.id,status:"draft"});
   error=r.error;
  }
  setBusy(false);
  if(error){setError(error.message);return;}
  clearComposer();success("Campaña guardada.");await reload();
 }
 async function sendCampaign(draft:Draft){
  const channel=draft.channel||"email";
  if(channel==="push"){
   if(!marketingStatus.push){setError("Las notificaciones no están activadas.");return;}
   const pricing=await db().rpc("business_push_pricing",{p_business:selected});
   const p=(pricing.data||[])[0] as {devices:number;price_cents:number;total_cents:number;currency:string}|undefined;
   if(pricing.error||!p){setError(pricing.error?.message||"No se pudo calcular el presupuesto.");return;}
   if(draft.status==="draft"&&Number(p.devices)<1){setError("Todavía no hay destinatarios que hayan aceptado notificaciones.");return;}
   if(draft.status==="draft"){
    const amount=new Intl.NumberFormat("es-MX",{style:"currency",currency:p.currency}).format(Number(p.total_cents)/100);
    if(!window.confirm("Enviar a "+p.devices+" clientes por un máximo de "+amount+"?"))return;
   }
   setBusy(true);setError("");setNotice("");
   try{
    if(draft.status==="draft"){
     const queued=await db().rpc("business_queue_push_campaign",{p_campaign:draft.id,p_expected_total_cents:p.total_cents});
     if(queued.error)throw queued.error;
    }
    const resp=await fetch("/api/local/push/send",{method:"POST",credentials:"same-origin",
     headers:{"Content-Type":"application/json"},body:JSON.stringify({campaign_id:draft.id})});
    const result=await resp.json() as {error?:string;sent?:number;failed?:number};
    if(!resp.ok||result.error)throw new Error(result.error||"No se pudo enviar la campaña.");
    success((result.sent||0)+" notificaciones enviadas. Puedes continuar el envío desde el listado.");await reload();
   }catch(e){setError((e as Error).message)}finally{setBusy(false)}
   return;
  }
  if(!marketingStatus[channel]){setError(channel==="email"?"El envío de correos aún no está activado.":"WhatsApp todavía no está disponible.");return;}
  if(draft.status==="draft"&&channel==="whatsapp"&&!draft.template_name){setError("Antes de enviar WhatsApp hay que asociar una plantilla aprobada.");return;}
  const result=await db().rpc(channel==="email"?"business_mail_quote":"business_whatsapp_quote",{p_business:selected});
  const current=(result.data||[])[0] as MailQuote|undefined;
  if(result.error||!current||current.price_cents==null||current.total_cents==null){setError("No está definida la tarifa para este canal.");return;}
  if(draft.status==="draft"&&Number(current.contacts)<1){setError("No hay destinatarios con consentimiento para este canal.");return;}
  const estimate=new Intl.NumberFormat("es-MX",{style:"currency",currency:current.currency}).format(Number(current.total_cents)/100);
  const question=draft.status==="draft"?
   "¿Confirmas el envío por "+(channel==="email"?"correo":"WhatsApp")+" a "+current.contacts+" destinatarios? Coste máximo estimado: "+estimate+". El importe final corresponde a los mensajes enviados.":
   "¿Reanudar la cola de mensajes pendientes?";
  if(!window.confirm(question))return;
  setBusy(true);setError("");setNotice("");
  try{
   const resp=await fetch("/api/local/marketing/send",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({campaign_id:draft.id,expected_total_cents:current.total_cents})});
   const value=await resp.json() as {error?:string;sent?:number;failed?:number;remaining?:number};
   if(!resp.ok||value.error)throw Error(value.error||"No se pudo enviar la campaña.");
   success("Envío procesado: "+(value.sent||0)+" aceptados, "+(value.failed||0)+" fallidos y "+(value.remaining||0)+" pendientes. La actividad queda registrada en Kreyv.");
   await reload();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const repeatCount=customers.filter(c=>Number(c.visits)>=2).length,canvassed=customers.filter(c=>c.marketing_ok).length;
 const programType=prog?.type;
 const currency=displayCurrency(biz?.currency);
 const formatBalance=(n:number)=>units(n,programType,currency);
 return <div className="business-workspace">
  {manageable.length>0&&<div className="business-selector"><span>Estás gestionando</span><select value={selected} onChange={e=>{setSelected(e.target.value);window.sessionStorage.setItem("loyally_selected_business",e.target.value);openSection("overview");setNotice("")}}>{manageable.map(b=><option key={b.business_id} value={b.business_id}>{b.businesses?.name||b.business_id}</option>)}</select><ChevronDown size={16}/></div>}
  {!selected?<div className="empty-state"><Store size={33}/><h3>Todavía no gestionas ningún negocio</h3><p>Solicita acceso a tu establecimiento para comenzar.</p></div>:<>
   <div className="workspace-section-layout">
    <header className="business-section-heading">
     <div><span className="page-eyebrow">PANEL DE NEGOCIO</span><h2>{tabs.find(t=>t.id===tab)?.label||"Resumen"}</h2></div>
     <Link className="button button-outline button-sm" href={"/negocio/vista-previa?business="+encodeURIComponent(selected)}>Vista previa de la tarjeta <ArrowUpRight size={16}/></Link>
    </header>
    
    <div className="workspace-section-body">
   {error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success"><Check size={17}/>{notice}</div>}
   {loading&&!biz?<div className="soft-panel">Cargando negocio...</div>:biz&&prog&&<>
   {tab==="card"&&<nav className="business-card-tabs" aria-label="Configurar mi tarjeta">
    <button type="button" className={cardArea==="design"?"active":""} aria-pressed={cardArea==="design"} onClick={()=>setCardArea("design")}><Brush size={16}/> Diseño</button>
    <button type="button" className={cardArea==="rules"?"active":""} aria-pressed={cardArea==="rules"} onClick={()=>setCardArea("rules")}><Ticket size={16}/> Sellos, puntos y reglas</button>
    <button type="button" className={cardArea==="rewards"?"active":""} aria-pressed={cardArea==="rewards"} onClick={()=>setCardArea("rewards")}><Gift size={16}/> Premios</button>
   </nav>}

   {tab==="overview"&&<><div className="kpi-grid three"><KPI icon={<Users size={20}/>} theme="purple" title="Clientes" value={customers.length} helper="Tarjetas inscritas"/><KPI icon={<Activity size={20}/>} theme="green" title="Visitas" value={Number(metrics.find(m=>m.metric==="visits")?.current_value||0)} helper={"Últimos "+periodDays+" días"}/><KPI icon={<Gift size={20}/>} theme="peach" title="Premios canjeados" value={Number(metrics.find(m=>m.metric==="redemptions")?.current_value||0)} helper={"Últimos "+periodDays+" días"}/></div>
    <div className="demo-two-cols"><section className="panel-card"><h2>Últimos movimientos</h2><p className="muted">Cada visita es una oportunidad para fidelizar.</p>{transactions.slice(0,6).map(t=><div className="activity-row" key={t.id}><div className={"activity-icon "+(t.kind==="earn"?"positive":"negative")}>{t.kind==="earn"?<Plus size={18}/>:<Gift size={18}/>}</div><div><strong>{t.kind==="earn"?"Compra verificada":"Recompensa canjeada"}</strong><span>{dateShort(t.created_at)} {t.ticket_ref?"· Ticket "+t.ticket_ref:""}</span></div><b className={t.amount_delta>0?"positive-text":"negative-text"}>{t.amount_delta>0?"+":""}{formatBalance(t.amount_delta)}</b></div>)}{transactions.length===0&&<p className="muted">Todavía no se han registrado movimientos.</p>}</section>
    <section className="panel-card overview-card"><div className="panel-icon"><Gift size={23}/></div><h2>Tu programa en una mirada</h2><div className="overview-stat"><span>Modalidad</span><strong>{programType==="stamps"?"Sellos":programType==="points"?"Puntos":"Saldo a favor"}</strong></div><div className="overview-stat"><span>Recompensa</span><strong>{prog.reward_label}</strong></div><div className="overview-stat"><span>Clientes que reciben promociones</span><strong>{canvassed}</strong></div><a className="button button-outline button-full" href={"/negocio/vista-previa?business="+encodeURIComponent(selected)}>Ver la tarjeta como cliente <ArrowUpRight size={16}/></a><button className="button button-outline button-full" onClick={()=>openSection("card")}>Configurar mi tarjeta <ArrowUpRight size={16}/></button><Link href="/negocio/customers" className="button button-outline button-full">Ver mis clientes <Users size={16}/></Link></section></div>
   </>}
   {tab==="settings"&&<div className="settings-grid"><form className="panel-card" onSubmit={e=>{e.preventDefault();saveBusiness({name:biz.name,description:biz.description,category:biz.category,public_listing:biz.public_listing})}}><div className="panel-icon"><Settings2 size={22}/></div><h2>Información del negocio</h2><p className="muted">Así te descubrirán tus clientes.</p><p className="muted">Moneda del establecimiento: <strong>{currency}</strong></p><div className="form-stack"><label>Nombre comercial<input required value={biz.name} onChange={e=>setBiz({...biz,name:e.target.value})}/></label><label>¿Qué tipo de negocio tienes?<select value={biz.category||""} onChange={e=>setBiz({...biz,category:e.target.value})}><option value="">Seleccionar</option>{BUSINESS_CATEGORIES.map(v=><option key={v.name}>{v.name}</option>)}</select></label><div className="business-category-preview"><StampMark kind={categoryStampKind(biz.category)} size={28}/><span>Este es el icono sugerido por tu categoría. Puedes elegir otro para el mapa y las tarjetas desde «Mi tarjeta».</span></div><label>Descripción<textarea rows={5} maxLength={500} value={biz.description||""} onChange={e=>setBiz({...biz,description:e.target.value})} placeholder="Cuéntales a tus clientes qué hace especial a tu negocio..."/></label><div className="check-control"><input id="public-listing" type="checkbox" checked={biz.public_listing} onChange={e=>setBiz({...biz,public_listing:e.target.checked})}/><label htmlFor="public-listing"><strong>Aparecer en el directorio público</strong><small>Tu negocio podrá descubrirse en el mapa cuando tenga una ubicación.</small></label></div><button className="button button-dark" disabled={busy}>Guardar cambios</button></div></form><section className="panel-card"><h2>Tu identidad de marca</h2><p className="muted">Sube un logo para personalizar la tarjeta y la ficha de tu negocio.</p><div className="upload-preview">{biz.logo_url?<img src={biz.logo_url} alt="Logo del negocio"/>:<div className="upload-logo" style={{background:biz.accent_color}}>{initials(biz.name)}</div>}</div><label className="file-input"><ImagePlus size={18}/> Subir logotipo <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files?.[0]||null,"logo_url")}/></label><div className="info-callout"><ShieldCheck size={18}/> Puedes usar una imagen de hasta 5 MB. Tu logotipo se mostrará a quienes descubran el negocio y guarden su tarjeta.</div></section></div>}

   {tab==="card"&&cardArea==="design"&&<div className="designer-grid lp-new-designer">
    <section className="panel-card"><div className="panel-icon"><Brush size={22}/></div><h2>Diseña tu tarjeta</h2><p className="muted">Personaliza los sellos y sus colores. Tus clientes verán los cambios en sus tarjetas.</p>
     <div className="form-stack">
      <label>Mensaje en la tarjeta<input value={biz.card_text||""} maxLength={60} placeholder="GRACIAS POR VOLVER" onChange={e=>setBiz({...biz,card_text:e.target.value})}/></label>

      <label className="color-input-label">Fondo de la tarjeta <span><input aria-label="Elegir color de fondo" type="color" value={biz.accent_color} onChange={e=>setBiz({...biz,accent_color:e.target.value})}/><code>{biz.accent_color}</code></span></label>
      <div className="preset-palette">{COLOR_PRESETS.map(color=><button type="button" title={color} aria-label={"Elegir color "+color} onClick={()=>setBiz({...biz,accent_color:color})} style={{background:color}} key={color}/>)}</div>
      <label className="color-input-label">Color de las letras <span><input aria-label="Elegir color de las letras" type="color" value={biz.card_text_color||"#ffffff"} onChange={e=>setBiz({...biz,card_text_color:e.target.value})}/><code>{biz.card_text_color||"#ffffff"}</code></span></label>
      {prog.type==="stamps"&&<>
       <strong className="lp-icon-heading">1. Elige el dibujo de tus sellos</strong>
       <div className="role-demo-icon-grid lp-real-icon-grid">{STAMP_OPTIONS.map(option=><button type="button" key={option.id} className={(biz.stamp_icon||"coffee")===option.id&&!biz.stamp_image_url?"selected":""} aria-label={"Sello de "+option.label} aria-pressed={(biz.stamp_icon||"coffee")===option.id&&!biz.stamp_image_url} onClick={()=>setBiz({...biz,stamp_icon:option.id,stamp_image_url:null})}><StampMark kind={option.id} size={30} color={biz.stamp_color||"#571c32"}/><span>{option.label}</span></button>)}</div>
       <div className="stamp-color-panel">
        <strong className="lp-icon-heading">2. Elige el color de tu sello</strong>
        <p className="muted">Utiliza uno de estos colores o elige el que mejor combine con tu negocio. El cambio se verá en las tarjetas de tus clientes.</p>
        <div className="stamp-color-row">
         <div className="stamp-color-sample"><StampMark kind={biz.stamp_icon||"coffee"} size={38} color={biz.stamp_color||"#571c32"}/><span>Tu sello</span></div>
         <label className="color-input-label">Color personalizado <span><input aria-label="Cambiar color del sello" type="color" value={biz.stamp_color||"#571c32"} onChange={e=>setBiz({...biz,stamp_color:e.target.value})}/><code>{biz.stamp_color||"#571c32"}</code></span></label>
        </div>
        <div className="stamp-color-palette" role="group" aria-label="Colores sugeridos para el sello">
         {STAMP_COLOR_PRESETS.map(color=><button type="button" key={color} style={{backgroundColor:color}} className={(biz.stamp_color||"#571c32").toLowerCase()===color?"selected":""} title={"Elegir "+color} aria-label={"Elegir color de sello "+color} aria-pressed={(biz.stamp_color||"#571c32").toLowerCase()===color} onClick={()=>setBiz({...biz,stamp_color:color})}/>)}
        </div>
       </div>
       <label className="file-input"><ImagePlus size={18}/> Subir sello propio <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files?.[0]||null,"stamp_image_url")}/></label>
       {biz.stamp_image_url&&<button type="button" className="role-demo-textbutton" onClick={()=>setBiz({...biz,stamp_image_url:null})}>Quitar imagen personalizada</button>}
       <small className="muted">Elige uno de nuestros dibujos o, si lo prefieres, sube tu propia imagen. Todos tus clientes verán el sello que hayas elegido.</small>
      </>}
      <label className="file-input"><ImagePlus size={18}/> Subir imagen de fondo <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files?.[0]||null,"card_background")}/></label>{biz.card_background&&<button type="button" className="role-demo-textbutton" onClick={()=>saveBusiness({card_background:null})}>Quitar imagen de fondo</button>}
      <button className="button button-dark button-full" disabled={busy} type="button" onClick={saveDesigner}>{busy?"Guardando...":"Guardar diseño"} <Check size={17}/></button>
     </div>
    </section>
    <section className="panel-card designer-preview-wrap lp-designer-live">
     <span className="eyebrow">VISTA PREVIA EN DIRECTO</span>
     {prog.type==="stamps"?<StampCard name={biz.name} color={biz.accent_color} textColor={biz.card_text_color} stampColor={biz.stamp_color} reward={prog.reward_label} total={prog.type==="stamps"?prog.reward_cost:8} earned={Math.min(previewEarned,prog.type==="stamps"?prog.reward_cost:8)} icon={biz.stamp_icon} imageUrl={biz.stamp_image_url} logoUrl={biz.logo_url} backgroundUrl={biz.card_background} message={biz.card_text} qrValue={(siteOrigin||process.env.NEXT_PUBLIC_SITE_URL||"")+"/unirse/"+biz.slug}/>:<div className="lp-other-program-preview" style={{backgroundColor:biz.accent_color,color:biz.card_text_color||"#ffffff"}}><span>{biz.card_text||"GRACIAS POR VOLVER"}</span><h3>{biz.name}</h3><strong>{prog.type==="points"?"Programa de puntos":"Programa de saldo a favor"}</strong><p>{prog.reward_label}</p></div>}
     {prog.type==="stamps"&&<label className="lp-preview-range">Sellos en la vista previa: <strong>{Math.min(previewEarned,prog.reward_cost)} de {prog.reward_cost}</strong><input type="range" min={0} max={prog.reward_cost} value={Math.min(previewEarned,prog.reward_cost)} onChange={e=>setPreviewEarned(Number(e.target.value))}/></label>}
     <p className="tiny-note">Comparte el enlace de inscripción. Cada cliente tendrá su propio QR para registrar visitas.</p>
     <a className="button button-outline button-full" href={"/negocio/vista-previa?business="+encodeURIComponent(selected)}>Previsualizar mi tarjeta <ArrowUpRight size={17}/></a>
    </section>
   </div>}
   {tab==="card"&&cardArea==="rules"&&<form className="panel-card program-form" onSubmit={saveProgram}><div className="panel-icon"><Gift size={22}/></div><h2>Tu programa de fidelización</h2><p className="muted">Elige cómo recompensar. Para evitar confusiones, configura la modalidad antes de que haya clientes inscritos.</p><div className="program-type-grid">{([{id:"stamps",label:"Sellos",desc:"Cada compra suma sellos",icon:<Ticket/>},{id:"points",label:"Puntos",desc:"Puntos por importe gastado",icon:<StarIcon/>},{id:"cashback",label:"Saldo a favor",desc:"Recupera parte de tus compras",icon:<Wallet/>}] as const).map(x=><button type="button" key={x.id} className={"program-type"+(prog.type===x.id?" selected":"")} disabled={customers.length>0&&prog.type!==x.id} onClick={()=>setProg({...prog,type:x.id})}><span>{x.icon}</span><strong>{x.label}</strong><small>{x.desc}</small></button>)}</div><div className="form-stack">
   <label>Nombre de la recompensa<input value={prog.reward_label} required onChange={e=>setProg({...prog,reward_label:e.target.value})} placeholder="Café gratis"/></label>
   {prog.type==="stamps"&&<div className="form-two"><label>Sellos necesarios para canjear<input type="number" min={1} value={prog.reward_cost} onChange={e=>setProg({...prog,reward_cost:Number(e.target.value)})}/></label><label>Máx. sellos por operación<input type="number" min={1} max={100} value={prog.max_stamps_per_action} onChange={e=>setProg({...prog,max_stamps_per_action:Number(e.target.value)})}/></label></div>}
   {prog.type==="points"&&<div className="form-two"><label>Puntos por cada unidad monetaria ({currency})<input type="number" min={0.01} max={100} step=".01" value={prog.points_per_euro} onChange={e=>setProg({...prog,points_per_euro:Number(e.target.value)})}/></label><label>Puntos para canjear<input type="number" min={1} value={prog.reward_cost} onChange={e=>setProg({...prog,reward_cost:Number(e.target.value)})}/></label></div>}
   {prog.type==="cashback"&&<label>Porcentaje que vuelve como saldo<input type="number" min={0.01} max={100} step=".01" value={prog.cashback_bps/100} onChange={e=>setProg({...prog,cashback_bps:Math.round(Number(e.target.value)*100)})}/><small>El saldo que gana el cliente se calcula automáticamente en cada compra.</small></label>}
   <div className="form-two"><label>Máximo importe por ticket ({currency})<input type="number" min={1} step=".01" value={prog.max_ticket_cents/100} onChange={e=>setProg({...prog,max_ticket_cents:Math.round(Number(e.target.value)*100)})}/></label><label>Espera mínima entre compras (segundos)<input type="number" min={0} max={86400} value={prog.min_seconds_between_awards} onChange={e=>setProg({...prog,min_seconds_between_awards:Number(e.target.value)})}/></label></div>
   <div className="form-two"><label>Máx. compras por empleado al día<input type="number" min={1} max={250} value={prog.max_daily_awards_per_employee} onChange={e=>setProg({...prog,max_daily_awards_per_employee:Number(e.target.value)})}/></label>
   <div className="check-control"><input id="require-ticket" type="checkbox" checked={prog.require_ticket_reference} onChange={e=>setProg({...prog,require_ticket_reference:e.target.checked})}/><label htmlFor="require-ticket"><strong>Exigir referencia de ticket</strong><small>Evita reutilizar el mismo identificador de venta dentro del negocio.</small></label></div></div>
   <div className="info-callout"><ShieldCheck size={18}/> Cada visita queda registrada con la fecha y el empleado que la atendió, para que puedas consultar el historial y corregir errores.</div>
   <button disabled={busy} className="button button-dark">Guardar programa <Check size={17}/></button></div></form>}
    {tab==="card"&&cardArea==="rewards"&&<RewardCatalog businessId={selected} options={rewardOptions} onSaved={reload}/>}
   {tab==="team"&&<div className="team-section">
    {teamView==="list"?<>
     <div className="campaign-page-header team-page-header"><div><span className="page-eyebrow">PERSONAL DEL NEGOCIO</span><h2>Empleados y accesos</h2>
      <p>Gestiona quién puede registrar visitas, canjear premios o ayudarte con el negocio.</p></div>
      <button type="button" className="button button-dark" onClick={()=>setTeamView("invite")}><Plus size={18}/> Añadir empleado</button>
     </div>
     <section className="panel-card team-list-panel">
      <div className="content-heading"><div><h3>{staff.length} personas en el equipo</h3><p>Permisos y estado de las cuentas de este establecimiento.</p></div></div>
      {staff.length?staff.map(x=><div className="activity-row team-row" key={x.user_id}>
       <div className="person-initial">{initials(x.full_name||privateEmail(x.email))}</div>
       <div><strong>{x.full_name||privateEmail(x.email)}</strong><span>{privateEmail(x.email)} · {x.role==="owner"?"Propietario":x.role==="manager"?"Responsable":"Empleado"}</span></div>
       {x.role!=="owner"&&<button type="button" disabled={busy} onClick={()=>toggleStaff(x.user_id,!x.active)} className={"table-pill "+(x.active?"":"inactive")}>{x.active?"Activo":"Inactivo"}</button>}
      </div>):<div className="campaign-empty-state"><Users size={26}/><h3>Aún no has añadido empleados</h3><p>Invita a tu primer colaborador para registrar visitas.</p><button type="button" className="button button-dark" onClick={()=>setTeamView("invite")}>Añadir empleado</button></div>}
      {invites.length>0&&<><h3 className="subheading">Invitaciones pendientes</h3>{invites.map(x=><div className="activity-row" key={x.id}><div className="activity-icon positive"><Mail size={17}/></div><div><strong>{privateEmail(x.email)}</strong><span>{x.role==="manager"?"Responsable":"Empleado"} · Pendiente de aceptación</span></div></div>)}</>}
     </section>
    </>:<>
     <div className="campaign-page-header"><div><button type="button" className="campaign-editor-back" onClick={()=>setTeamView("list")}>← Volver a empleados</button>
      <h2>Invitar a un empleado</h2><p>Elige el correo y el tipo de acceso que tendrá.</p></div>
      <button type="button" className="button button-outline" onClick={()=>setTeamView("list")}>Cancelar</button>
     </div>
     <form className="panel-card team-invite-form" onSubmit={invite}>
      <div className="panel-icon"><Users size={23}/></div>
      <div className="form-stack"><label>Correo electrónico del empleado<input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="empleado@negocio.com" required/></label>
       <label>Tipo de acceso<select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}><option value="employee">Empleado: escanear y canjear</option>
        {account.businesses.find(x=>x.business_id===selected)?.role==="owner"&&<option value="manager">Responsable: gestionar negocio</option>}
       </select></label>
       <button type="submit" className="button button-dark" disabled={busy}>{busy?"Guardando...":"Crear invitación"} <Plus size={17}/></button>
      </div>
      <p className="tiny-note">El empleado podrá aceptar su invitación al acceder con este correo.</p>
     </form>
    </>}
   </div>}
   {tab==="customers"&&<section className="panel-card"><div className="content-heading"><div><h2>Tu comunidad</h2><p>Clientes inscritos y actividad en tu negocio.</p></div><span className="table-pill">{customers.length} clientes</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Email</th><th>Saldo</th><th>Visitas</th><th>Marketing</th><th>Alta</th></tr></thead><tbody>{customers.map(x=><tr key={x.user_id}><td><strong>{x.full_name||"Sin nombre"}</strong></td><td><code className="customer-obfuscated-email">{privateEmail(x.email)}</code></td><td><b>{formatBalance(x.balance)}</b></td><td>{x.visits}</td><td>{x.marketing_ok?<span className="table-pill">Aceptado</span>:<span className="table-pill inactive">No</span>}</td><td>{dateShort(x.joined_at)}</td></tr>)}</tbody></table></div>{customers.length===0&&<p className="muted">Comparte tu programa para conseguir tus primeros clientes.</p>}</section>}
   {tab==="locations"&&<div className="business-location-layout">
    <section className="panel-card business-location-intro">
     <div className="panel-icon"><MapPin size={23}/></div><h2>Tu establecimiento</h2>

     {locations.length?<><strong>{locations[0].name}</strong><p>{locations[0].address}<br/>{locations[0].city}, {locations[0].country}</p></>:
      <div className="info-callout">Este establecimiento todavía no tiene dirección asignada. Nuestro equipo puede activarla.</div>}
     <div className="business-location-request"><strong>¿Necesitas otro establecimiento?</strong><p>Cada nuevo local se registra por separado en Kreyv. Podemos vincular varios al mismo propietario y valorar condiciones especiales para cadenas.</p><Link href="/solicitar-acceso" className="button button-outline">Solicitar otro local <ArrowUpRight size={16}/></Link></div>
    </section>
    {locations.length>0&&<form className="panel-card" onSubmit={saveLocation}>
     <h2>Editar dirección</h2>
     <div className="form-stack"><label>Nombre del establecimiento<input required minLength={2} value={locationName} onChange={e=>setLocationName(e.target.value)}/></label>
      <AddressPicker address={address} city={city} country={country} lat={lat} lng={lng} onAddressChange={setAddress} onCityChange={setCity} onCountryChange={setCountry} onCoordinatesChange={(lat,lng)=>{setLat(lat);setLng(lng)}}/>
      <button type="submit" className="button button-dark" disabled={busy}>{busy?"Guardando...":"Guardar dirección"}</button>
     </div>
    </form>}
   </div>}
    {tab==="reports"&&<>
   <BusinessAnalytics metrics={metrics} ranking={ranking} days={periodDays} onDays={setPeriodDays} repeatCustomers={repeatCount} totalCustomers={customers.length}/>
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
        <td>{t.purchase_cents==null?"—":new Intl.NumberFormat("es-MX",{style:"currency",currency}).format(t.purchase_cents/100)}</td>
        <td>{actor?.full_name||actor?.email||"—"}</td>
        <td>{t.kind!=="reversal"&&!reversed?
         <button type="button" disabled={busy||new Date(t.created_at).getTime()<Date.now()-72*60*60*1000} className="inline-table-button" onClick={()=>reverseTransaction(t)}>Revertir</button>:
         <span title={t.reversal_reason||"Movimiento ya corregido"} className="table-pill inactive">{t.kind==="reversal"?"Registrado":"Corregido"}</span>}</td>
      </tr>})}</tbody></table></div>
   </div>
 </>}
   {tab==="marketing"&&<div className="campaign-page campaign-page-final">
    {campaignView==="list"?<>

     <div className="campaign-page-header">
      <div>
       <h2>Campañas</h2></div>
      <div className="campaign-compose-actions">
       <button type="button" className="button button-dark campaign-new-button" onClick={()=>{setEditingDraft(null);setMailSubject("");setMailBody("");setCampaignView("editor")}}><Plus size={18}/> Crear campaña</button>
      </div>
     </div>
     <div className="campaign-overview-grid">
      <div className="panel-card campaign-overview-stat"><span>Campañas creadas</span><strong>{drafts.length}</strong><small>Correo, WhatsApp y push</small></div>
      <div className="panel-card campaign-overview-stat"><span>Enviados</span><strong>{drafts.reduce((sum,d)=>sum+(Number(d.sent_count)||0),0)}</strong><small>Mensajes aceptados</small></div>
      <div className="panel-card campaign-overview-stat"><span>Consumo de campañas</span><strong>{usage.length?usage.map(u=>new Intl.NumberFormat("es-MX",{style:"currency",currency:u.currency}).format(Number(u.amount_cents)/100)).join(" · "):"—"}</strong><small>Importes registrados por canal</small></div>
     </div>
     <section className="panel-card campaign-list-panel">
      <div className="content-heading"><div><h3>Todas tus campañas</h3><p>Edita tus borradores o revisa las campañas que ya has preparado.</p></div></div>
      {drafts.length?<div className="campaign-management-list">{drafts.map(d=><article key={d.id} className="campaign-management-row">
       <div className="campaign-management-icon">{d.channel==="push"?<BellRing size={21}/>:d.channel==="whatsapp"?<Users size={21}/>:<Mail size={21}/>}</div>
       <div className="campaign-management-main"><strong>{d.subject}</strong><p>{d.channel==="push"?"Notificación push":d.channel==="whatsapp"?"WhatsApp":"Correo"} · {dateShort(d.created_at)}</p>
        <span className={"campaign-status campaign-status-"+d.status}>{d.status==="draft"?"Borrador":d.status==="sent"?"Enviada":d.status==="partial"?"Parcial":d.status==="failed"?"Fallida":"En proceso"}</span>
        {d.status!=="draft"&&<small>{d.sent_count||0} mensajes aceptados</small>}
       </div>
       <div className="campaign-management-actions">
        {d.status==="draft"&&<button type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>editDraft(d)}>Editar <Brush size={16}/></button>}
        {["draft","queued","sending"].includes(d.status)&&<button type="button" className="button button-dark button-sm" disabled={busy||!marketingStatus[d.channel||"email"]} onClick={()=>sendCampaign(d)}>{d.status==="draft"?"Enviar":"Continuar"} <ArrowUpRight size={16}/></button>}
       </div>
      </article>)}</div>:<div className="campaign-empty-state"><div className="panel-icon"><Mail size={24}/></div>
       <h3>Tu primera campaña empieza aquí</h3><p>Cuenta una novedad, presenta una oferta o invita a tus clientes a volver.</p>
       <button type="button" className="button button-dark" onClick={()=>setCampaignView("editor")}>Crear campaña <Plus size={16}/></button>
      </div>}
     </section>
    </>:<>
     <div className="campaign-page-header">
      <div><button type="button" className="campaign-editor-back" onClick={clearComposer}><ArrowUpRight size={16}/> Todas las campañas</button>
       <h2>{editingDraft?"Editar campaña":"Nueva campaña"}</h2><p>Da forma al mensaje y guárdalo para revisarlo antes del envío.</p></div>
      <button type="button" className="button button-outline" onClick={clearComposer}>Cancelar</button>
     </div>
     <form className="panel-card campaign-editor-full" onSubmit={saveDraft}>
      <div className="campaign-channel-switch" role="group" aria-label="Canal de campaña">
       <button type="button" className={marketingChannel==="email"?"active":""} disabled={!!editingDraft} onClick={()=>setMarketingChannel("email")}><Mail size={17}/> Correo electrónico</button>
       <button type="button" className={marketingChannel==="whatsapp"?"active":""} disabled={!!editingDraft} onClick={()=>setMarketingChannel("whatsapp")}><Users size={17}/> WhatsApp</button>
       <button type="button" className={marketingChannel==="push"?"active":""} disabled={!!editingDraft} onClick={()=>setMarketingChannel("push")}><BellRing size={17}/> Notificación push</button>
      </div>
      {!marketingStatus[marketingChannel]&&<div className="info-callout"><ShieldCheck size={18}/>{marketingChannel==="push"?"Las notificaciones aún no están disponibles.":marketingChannel==="whatsapp"?"WhatsApp aún no está disponible.":"El correo aún no está disponible."}</div>}
      <div className="form-stack">
       <label>{marketingChannel==="push"?"Título de la notificación":marketingChannel==="email"?"Asunto":"Nombre de campaña"}<input required maxLength={marketingChannel==="push"?120:180} value={mailSubject} onChange={e=>setMailSubject(e.target.value)} placeholder="¡Tenemos una sorpresa para ti!"/></label>
       <div><label className="campaign-editor-label">Mensaje</label>
        {marketingChannel==="push"?<textarea className="campaign-push-textarea" minLength={3} maxLength={500} value={mailBody} onChange={e=>setMailBody(e.target.value)} placeholder="Vuelve esta semana y disfruta de una promoción exclusiva." rows={6}/>:
         <RichMessageEditor value={mailBody} onChange={setMailBody} channel={marketingChannel}/>}
       </div>
       <div className="campaign-editor-budget"><strong>Previsión del envío</strong>
        <span>{quote?.contacts??"—"} destinatarios · {quote?.price_cents!=null?new Intl.NumberFormat("es-MX",{style:"currency",currency:quote.currency}).format(Number(quote.price_cents)/100)+" por mensaje":"Tarifa pendiente"} · {quote?.total_cents!=null?new Intl.NumberFormat("es-MX",{style:"currency",currency:quote.currency}).format(Number(quote.total_cents)/100)+" estimados":"Sin presupuesto"}</span></div>
       <div className="campaign-compose-actions"><button type="submit" disabled={busy||mailBody.trim().length<3} className="button button-dark">{busy?"Guardando...":editingDraft?"Guardar cambios":"Guardar campaña"} <Check size={17}/></button>
        <button type="button" className="button button-outline" onClick={clearComposer}>Volver al listado</button></div>
      </div>
      
     </form>
    </>}
   </div>}
   </>}
  </div></div></>}
 </div>;
}
function KPI({icon,theme,title,value,helper}:{icon:React.ReactNode;theme:string;title:string;value:string|number;helper:string}){return <div className="kpi-card"><div className={"kpi-symbol "+theme}>{icon}</div><span>{title}</span><strong>{value}</strong><small>{helper}</small></div>}
function StarIcon(){return <span style={{fontSize:24,lineHeight:1}}>✦</span>}
