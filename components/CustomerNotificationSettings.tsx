"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {BellRing,Mail,MessageCircle,Settings2,Store} from "lucide-react";
import {db} from "@/lib/supabase";
import {showActionToast} from "@/lib/action-toast";
import type {Account} from "@/components/AppFrame";

type Channel="email"|"whatsapp"|"push";
type Consent={business_id:string;opted_in:boolean;whatsapp_opted_in:boolean;push_opted_in:boolean};
type MembershipRow={id:string;business_id:string;businesses:{id:string;name:string;accent_color:string}|null};
type CardChoice={id:string;business_id:string;name:string;color:string;email:boolean;whatsapp:boolean;push:boolean};
const controls:{id:Channel;label:string;description:string;Icon:typeof Mail}[]=[
 {id:"email",label:"Correo electrónico",description:"Ofertas, premios y novedades por email",Icon:Mail},
 {id:"whatsapp",label:"WhatsApp",description:"Promociones y regalos en tu número de WhatsApp",Icon:MessageCircle},
 {id:"push",label:"Notificaciones push",description:"Avisos en este móvil, si permites las notificaciones",Icon:BellRing}
];
const column:Record<Channel,keyof CardChoice>={email:"email",whatsapp:"whatsapp",push:"push"};

export function CustomerNotificationSettings({account}:{account:Account}){
 const [cards,setCards]=useState<CardChoice[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [focusBusiness,setFocusBusiness]=useState("");
 const [expandedBusiness,setExpandedBusiness]=useState<string|null>(null);
 const whatsappReady=/^\+[1-9][0-9]{7,14}$/.test(account.user.user_metadata?.whatsapp||"");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const result=await db().from("loyalty_memberships")
    .select("id,business_id,businesses(id,name,accent_color)").eq("customer_id",account.user.id)
    .order("created_at",{ascending:false});
   if(result.error)throw result.error;
   const memberships=(result.data||[]) as MembershipRow[];
   if(!memberships.length){setCards([]);return;}
   const consent=await db().from("marketing_consents")
    .select("business_id,opted_in,whatsapp_opted_in,push_opted_in")
    .eq("customer_id",account.user.id).in("business_id",memberships.map(x=>x.business_id));
   if(consent.error)throw consent.error;
   const byId=new Map(((consent.data||[]) as Consent[]).map(c=>[c.business_id,c]));
   const next=memberships.filter(x=>!!x.businesses).map(m=>{
    const preferences=byId.get(m.business_id);
    return {id:m.id,business_id:m.business_id,name:m.businesses!.name,
     color:m.businesses!.accent_color||"#571c32",
     email:preferences?.opted_in===true,whatsapp:preferences?.whatsapp_opted_in===true,
     push:preferences?.push_opted_in===true};
   });
   setCards(next);
   if(next.length< memberships.length)setError("Algunas tarjetas no están disponibles. Actualiza para volver a cargarlas.");
  }catch(e){setError((e as Error).message||"No se pudieron cargar tus preferencias.");}
  finally{setLoading(false);}
 },[account.user.id]);
 useEffect(()=>{
  const focused=new URLSearchParams(window.location.search).get("business")||"";
  setFocusBusiness(focused);setExpandedBusiness(focused||null);void load();
 },[load]);
 useEffect(()=>{if(!loading&&focusBusiness){
  const target=document.getElementById("notification-"+focusBusiness);
  target?.scrollIntoView({block:"center",behavior:"smooth"});
 }},[loading,focusBusiness]);
 async function change(card:CardChoice,channel:Channel,checked:boolean){
  if(busy)return;
  if(channel==="whatsapp"&&checked&&!whatsappReady){
   setError("Para activar WhatsApp necesitas añadir tu número con prefijo internacional en Mi perfil.");
   return;
  }
  const key=card.business_id+":"+channel;
  setBusy(key);setNotice("");setError("");
  try{
   if(channel==="push"){
    const response=await fetch("/api/local/push/preferences",{
     method:"POST",credentials:"same-origin",cache:"no-store",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({action:"consent",business_id:card.business_id,opted_in:checked})
    });
    const result=await response.json() as {error?:string};
    if(!response.ok||result.error)throw Error(result.error||"No se pudo guardar el aviso push.");
   }else{
    const name=channel==="email"?"business_upsert_consent":"business_upsert_whatsapp_consent";
    const result=await db().rpc(name,{p_business:card.business_id,p_opted_in:checked});
    if(result.error)throw result.error;
   }
   const columnName=column[channel];
   setCards(prev=>prev.map(item=>item.business_id===card.business_id?
    {...item,[columnName]:checked}:item));
   const message=(checked?"Activado":"Desactivado")+": "+controls.find(x=>x.id===channel)?.label+" de "+card.name+".";
   setNotice(message);
   showActionToast(message);
  }catch(e){const message=(e as Error).message||"No se pudo guardar la preferencia.";setError(message);showActionToast(message,"error");}
  finally{setBusy(null);}
 }
 return <section className="panel-card customer-channel-settings">
  <div className="panel-icon"><Settings2 size={22}/></div>
  <h2>Notificaciones de mis tarjetas</h2>

  {loading?<p className="muted">Cargando tus tarjetas...</p>:cards.length===0?
   <div className="empty-state compact"><Store size={25}/><h3>Todavía no tienes tarjetas</h3><p>Descubre un negocio y guarda su tarjeta para configurar sus avisos.</p><Link href="/app/descubrir" className="button button-dark">Descubrir negocios</Link></div>:
   <>   <div className="customer-channel-cards">{cards.map(card=>
    <details className="customer-channel-business" key={card.business_id} id={"notification-"+card.business_id} open={expandedBusiness===card.business_id}
     onToggle={event=>{const isOpen=event.currentTarget.open;setExpandedBusiness(current=>isOpen?card.business_id:current===card.business_id?null:current)}}>
     <summary>
      <span className="customer-channel-business-mark" style={{background:card.color}}>{card.name.slice(0,1).toUpperCase()}</span>
      <span className="customer-channel-business-title"><strong>{card.name}</strong><small>{[card.email,card.whatsapp,card.push].filter(Boolean).length} de 3 canales activados</small></span>
      <span className="customer-channel-chevron">⌄</span>
     </summary>
     <div className="customer-channel-options">{controls.map(({id,label,description,Icon})=>{
      const checked=card[id],disabled=busy!==null;
      return <label key={id} className="customer-channel-option">
       <span className="customer-channel-option-icon"><Icon size={19}/></span>
       <span className="customer-channel-option-copy"><strong>{label}</strong><small>{description}</small></span>
       <input type="checkbox" checked={checked} disabled={disabled}
        onChange={e=>void change(card,id,e.target.checked)}
        aria-label={label+" de "+card.name}/>
      </label>;
     })}
      {!whatsappReady&&<p className="tiny-note">Para recibir WhatsApp, <Link href="/app/perfil">añade tu número en Mi perfil</Link>.</p>}
     </div>
    </details>
   )}</div></>}
  {notice&&<div className="alert success" role="status">{notice}</div>}
  {error&&<div className="alert error" role="alert">{error} <button type="button" className="inline-action" onClick={()=>void load()}>Reintentar</button></div>}
 </section>;
}
