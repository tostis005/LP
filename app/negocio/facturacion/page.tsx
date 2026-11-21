"use client";
import {useEffect,useState} from "react";
import {ArrowUpRight,Check,Clock3,CreditCard,ShieldCheck} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {db} from "@/lib/supabase";
type Billing={business_id:string;plan:string;status:string;trial_ends_at:string|null;stripe_customer_id:string|null;stripe_subscription_id:string|null;updated_at:string};
type Usage={channel:"email"|"whatsapp"|"push";messages:number;amount_cents:number;currency:string};
type Charge={offer_id:string;channel:"email"|"whatsapp"|"push";recipients:number;
 unit_price_cents:number;amount_cents:number;currency:string;confirmed_at:string;invoiced_at:string|null};
const statusLabels:Record<string,string>={
 trialing:"Prueba gratuita",active:"Suscripción activa",past_due:"Pago pendiente",
 canceled:"Cancelada",unpaid:"Impagada",incomplete:"Pendiente de completar",
 incomplete_expired:"Pago no completado",paused:"Pausada"
};
function OwnerBilling({account}:{account:Account}){
 const owners=account.businesses.filter(r=>r.role==="owner");
 const [selected,setSelected]=useState(owners[0]?.business_id||"");
 const [billing,setBilling]=useState<Billing|null>(null),[billingReady,setBillingReady]=useState({checkout:false,portal:false}),[usage,setUsage]=useState<Usage[]>([]),[charges,setCharges]=useState<Charge[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{
  const checkout=new URL(window.location.href).searchParams.get("checkout");
  if(checkout==="success")setNotice("La solicitud se ha recibido. La suscripción se actualizará cuando se confirme el pago.");
  if(checkout==="cancel")setNotice("No se ha realizado ningún cambio en tu suscripción.");
  fetch("/api/billing/status",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(v=>{if(v)setBillingReady({checkout:v.checkout===true,portal:v.portal===true});}).catch(()=>{});
 },[]);
 useEffect(()=>{if(!selected)return;let active=true;setLoading(true);setError("");
  Promise.all([
   db().from("business_billing").select("*").eq("business_id",selected).maybeSingle(),
   db().rpc("business_marketing_usage",{p_business:selected}),
   db().from("offer_campaign_charges").select("offer_id,channel,recipients,unit_price_cents,amount_cents,currency,confirmed_at,invoiced_at")
    .eq("business_id",selected).order("confirmed_at",{ascending:false}).limit(100)
  ]).then(([bill,messages,ledger])=>{
   if(!active)return;
   setBilling(bill.data as Billing|null);
   setUsage((messages.data||[]) as Usage[]);setCharges((ledger.data||[]) as Charge[]);
   setLoading(false);
   if(bill.error||messages.error||ledger.error)setError(bill.error?.message||messages.error?.message||ledger.error?.message||"No se pudo consultar el consumo.");
  });
  return()=>{active=false}
 },[selected]);
 async function action(kind:"checkout"|"portal"){
  if(!selected)return;setBusy(true);setError("");setNotice("");
  const {data}=await db().auth.getSession();
  const token=data?.session?.access_token;
  if(!token){setBusy(false);setError("Inicia sesión de nuevo para continuar.");return}
  try{
   const res=await fetch("/api/billing/"+kind,{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({business_id:selected})
   });
   const payload=await res.json() as {url?:string;error?:string};
   if(!res.ok||!payload.url)throw new Error(payload.error||"No se pudo abrir la facturación.");
   window.location.assign(payload.url);
  }catch(e){setError((e as Error).message);setBusy(false)}
 }
 if(!owners.length)return <div className="empty-state"><ShieldCheck size={28}/><h3>Acceso reservado al propietario</h3><p>Los empleados y managers no pueden gestionar métodos de pago ni suscripciones.</p></div>;
 return <><div className="business-selector"><span>Facturación de</span><select value={selected} onChange={e=>setSelected(e.target.value)}>{owners.map(o=><option value={o.business_id} key={o.business_id}>{o.businesses?.name||"Negocio"}</option>)}</select></div>
  {error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success"><Check size={17}/>{notice}</div>}
  <div className="billing-grid">
   <section className="panel-card billing-plan"><div className="panel-icon"><CreditCard size={23}/></div>
    <div className="eyebrow">PLAN BUSINESS</div><h2>Una comunidad que vale mucho más.</h2>
    <div className="billing-price">Kreyv Business</div>
    <p className="muted">Tus tarjetas, recompensas, clientes, resultados y personalización desde un mismo espacio.</p>
    {loading?<p className="muted">Cargando suscripción...</p>:billing&&<>
      <div className="billing-status"><span>Estado</span><strong>{statusLabels[billing.status]||billing.status}</strong></div>
      {billing.status==="trialing"&&billing.trial_ends_at&&<div className="billing-status"><span>Fin del período de prueba</span><strong>{new Date(billing.trial_ends_at).toLocaleDateString("es-ES")}</strong></div>}
      {billing.stripe_customer_id&&billingReady.portal?
       <button disabled={busy} className="button button-dark button-full" onClick={()=>action("portal")}>{busy?"Conectando...":"Gestionar pagos y facturas"} <ArrowUpRight size={18}/></button>:
       billingReady.checkout?<button disabled={busy} className="button button-dark button-full" onClick={()=>action("checkout")}>{busy?"Conectando...":"Configurar suscripción"} <ArrowUpRight size={18}/></button>:
       <div className="info-callout"><ShieldCheck size={17}/> La contratación en línea todavía no está disponible. Puedes seguir utilizando las funciones de tu negocio.</div>}
    </>}
   </section>

   <section className="panel-card"><div className="panel-icon peach"><ShieldCheck size={23}/></div><h2>Facturación sin sorpresas</h2>
    <p className="muted">Consulta el estado de tu plan y el consumo adicional de campañas con toda claridad.</p>
    <div className="privacy-item"><Check size={19}/> Solo el propietario puede gestionar los pagos y la suscripción.</div>
    <div className="privacy-item"><Check size={19}/> No almacenamos los números completos de las tarjetas bancarias.</div>
    <div className="privacy-item"><Check size={19}/> Los importes de campañas se registran por separado para facilitar su revisión.</div>
   </section>
   <section className="panel-card billing-marketing-usage"><div className="panel-icon"><CreditCard size={23}/></div>
    <h2>Consumo de campañas</h2><p className="muted">Las nuevas campañas unificadas conservan el importe cerrado que confirmaste al enviarlas. Las campañas anteriores mantienen su registro por mensajes aceptados.</p>
    {loading?<p className="muted">Consultando uso...</p>:usage.length?usage.map(x=>
     <div key={x.channel+"-"+x.currency} className="billing-status">
      <span>{x.channel==="email"?"Correo electrónico":x.channel==="push"?"Notificación push":"WhatsApp"} · {x.messages} destinatarios</span>
      <strong>{new Intl.NumberFormat("es-MX",{style:"currency",currency:x.currency}).format(Number(x.amount_cents)/100)}</strong>
     </div>):<p className="muted">Aún no tienes consumo adicional.</p>}
    <p className="tiny-note">Este es el registro para facturación posterior, no una factura fiscal emitida ni un cargo automático en Stripe.</p>
   </section>
   <section className="panel-card billing-marketing-usage">
    <h2>Campañas pendientes de facturar</h2>
    <p className="muted">Cada canal conserva su cantidad, tarifa y cargo confirmado en el momento del envío.</p>
    {charges.length?charges.map(x=><div className="billing-status" key={x.offer_id+"-"+x.channel}>
     <span>{x.channel==="email"?"Correo":x.channel==="push"?"Push":"WhatsApp"} · {x.recipients} ×
      {" "+new Intl.NumberFormat("es-MX",{style:"currency",currency:x.currency}).format(x.unit_price_cents/100)}
      <small style={{display:"block"}}>{new Date(x.confirmed_at).toLocaleDateString("es-ES")} · {x.invoiced_at?"Facturado":"Pendiente de facturar"}</small>
     </span>
     <strong>{new Intl.NumberFormat("es-MX",{style:"currency",currency:x.currency}).format(Number(x.amount_cents)/100)}</strong>
    </div>):<p className="muted">Todavía no se han confirmado campañas unificadas.</p>}
   </section>
  </div>
 </>;
}
export default function BillingPage(){return <AppFrame area="business" title="Tu suscripción" subtitle="Todo lo necesario para que tu programa siga creciendo.">{a=><OwnerBilling account={a}/>}</AppFrame>}
