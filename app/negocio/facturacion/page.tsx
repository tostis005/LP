"use client";
import {useEffect,useState} from "react";
import {ArrowUpRight,Check,Clock3,CreditCard,ShieldCheck} from "lucide-react";
import {AppFrame,type Account} from "@/components/AppFrame";
import {db} from "@/lib/supabase";
type Billing={business_id:string;plan:string;status:string;trial_ends_at:string|null;stripe_customer_id:string|null;stripe_subscription_id:string|null;updated_at:string};
type Usage={channel:"email"|"whatsapp";messages:number;amount_cents:number;currency:string};
const statusLabels:Record<string,string>={
 trialing:"Prueba gratuita",active:"Suscripción activa",past_due:"Pago pendiente",
 canceled:"Cancelada",unpaid:"Impagada",incomplete:"Pendiente de completar",
 incomplete_expired:"Pago no completado",paused:"Pausada"
};
function OwnerBilling({account}:{account:Account}){
 const owners=account.businesses.filter(r=>r.role==="owner");
 const [selected,setSelected]=useState(owners[0]?.business_id||"");
 const [billing,setBilling]=useState<Billing|null>(null),[usage,setUsage]=useState<Usage[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{
  const checkout=new URL(window.location.href).searchParams.get("checkout");
  if(checkout==="success")setNotice("Has regresado de Stripe. La activación se confirmará cuando llegue su notificación de pago.");
  if(checkout==="cancel")setNotice("No se ha realizado ningún cambio en tu suscripción.");
 },[]);
 useEffect(()=>{if(!selected)return;let active=true;setLoading(true);setError("");
  Promise.all([
   db().from("business_billing").select("*").eq("business_id",selected).maybeSingle(),
   db().rpc("business_marketing_usage",{p_business:selected})
  ]).then(([bill,messages])=>{
   if(!active)return;
   setBilling(bill.data as Billing|null);
   setUsage((messages.data||[]) as Usage[]);
   setLoading(false);
   if(bill.error||messages.error)setError(bill.error?.message||messages.error?.message||"No se pudo consultar el consumo.");
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
    <div className="billing-price">19,90 € <span>/mes (precio propuesto)</span></div>
    <p className="muted">Tarjetas QR, sellos, puntos, cashback, directorio, empleados, analítica y personalización incluidos.</p>
    {loading?<p className="muted">Cargando suscripción...</p>:billing&&<>
      <div className="billing-status"><span>Estado</span><strong>{statusLabels[billing.status]||billing.status}</strong></div>
      {billing.status==="trialing"&&billing.trial_ends_at&&<div className="billing-status"><span>Fin del período de prueba</span><strong>{new Date(billing.trial_ends_at).toLocaleDateString("es-ES")}</strong></div>}
      {billing.stripe_customer_id?
       <button disabled={busy} className="button button-dark button-full" onClick={()=>action("portal")}>{busy?"Conectando...":"Gestionar pagos y facturas"} <ArrowUpRight size={18}/></button>:
       <button disabled={busy} className="button button-dark button-full" onClick={()=>action("checkout")}>{busy?"Conectando...":"Configurar suscripción"} <ArrowUpRight size={18}/></button>}
    </>}
   </section>
   <section className="panel-card billing-marketing-usage"><div className="panel-icon"><CreditCard size={23}/></div>
    <h2>Consumo de campañas</h2><p className="muted">El correo y WhatsApp se contabilizan por separado, en función de los mensajes aceptados por el proveedor. Los precios los fija Loyally.</p>
    {loading?<p className="muted">Consultando uso...</p>:usage.length?usage.map(x=>
     <div key={x.channel+"-"+x.currency} className="billing-status">
      <span>{x.channel==="email"?"Correo electrónico":"WhatsApp"} · {x.messages} mensajes</span>
      <strong>{new Intl.NumberFormat("es-MX",{style:"currency",currency:x.currency}).format(Number(x.amount_cents)/100)}</strong>
     </div>):<p className="muted">Aún no tienes consumo adicional.</p>}
    <p className="tiny-note">Este es el registro de consumo, no una factura emitida. La facturación de los mensajes se habilitará cuando Loyally active el servicio comercial y el sistema de cobros correspondiente.</p>
   </section>
   <section className="panel-card"><div className="panel-icon peach"><ShieldCheck size={23}/></div><h2>Facturación sin sorpresas</h2>
    <p className="muted">Los pagos se realizan en Stripe. Loyally no almacena los números completos de tu tarjeta bancaria.</p>
    <div className="privacy-item"><Check size={19}/> Acceso a facturación reservado al propietario del negocio.</div>
    <div className="privacy-item"><Check size={19}/> Confirmación del estado mediante webhooks firmados, no por la pantalla de éxito.</div>
    <div className="privacy-item"><Check size={19}/> El lanzamiento comercial requiere configurar el precio y las claves privadas del servidor.</div>
    <div className="info-callout" style={{marginTop:23}}><Clock3 size={19}/> Durante el desarrollo, los pagos no se exigen. El administrador activará el control de suscripciones después de completar las pruebas.</div>
   </section>
  </div>
 </>;
}
export default function BillingPage(){return <AppFrame area="business" title="Tu suscripción" subtitle="Todo lo necesario para que tu programa siga creciendo.">{a=><OwnerBilling account={a}/>}</AppFrame>}
