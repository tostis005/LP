"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {ArrowUpRight,BellRing,Check,ImagePlus,Mail,Plus,RefreshCcw,Users} from "lucide-react";
import {db} from "@/lib/supabase";
type Channel="email"|"whatsapp"|"push";
type Kind="offer"|"notice";
type StoredKind=Kind|"news";
const kindLabels:Record<StoredKind,string>={offer:"Oferta",news:"Aviso",notice:"Aviso"};
type Rate={recipients:number;unit_price_cents:number|null;total_cents:number|null;currency:string;enabled:boolean};
type Price={channels:Record<Channel,Rate>};
type Campaign={id:string;channel:Channel;status:string;recipient_count:number;sent_count:number;failed_count:number};
type Offer={id:string;title:string;preview:string;image_url:string|null;kind:StoredKind;valid_from:string|null;valid_until:string|null;
 created_at:string;campaigns:Campaign[];confirmed_cents:number|string;confirmed_currency:string|null;
 charged_channels:number};
type SendState={campaigns:Campaign[];confirmed:boolean;total_cents:number;currency:string};
const channels:[Channel,string][]=[["email","Correo electrónico"],["whatsapp","WhatsApp"],["push","Notificación push"]];
function money(cents:number,currency:string){
 return new Intl.NumberFormat("es-MX",{style:"currency",currency:currency||"MXN"}).format(cents/100);
}
async function request(path:string,init?:RequestInit){
 const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...init});
 const result=await response.json() as {error?:string;[key:string]:unknown};
 if(!response.ok||result.error)throw new Error(result.error||"No se pudo completar la operación.");
 return result;
}
function post(path:string,body:object){
 return request(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
}
function readyPrice(rate?:Rate){return !!rate?.enabled&&rate.unit_price_cents!==null&&rate.total_cents!==null&&rate.recipients>0;}
function isPending(c:Campaign){return c.status==="queued"||c.status==="sending";}
export function BusinessOffersPanel({businessId,onCreated,onCampaignsLoaded}:{
 businessId:string;onCreated:()=>void;onCampaignsLoaded:(ids:string[],count:number)=>void;
}){
 const [offers,setOffers]=useState<Offer[]>([]),[showEditor,setShowEditor]=useState(false);
 const [title,setTitle]=useState(""),[preview,setPreview]=useState(""),[details,setDetails]=useState("");
 const [kind,setKind]=useState<Kind>("offer"),[terms,setTerms]=useState(""),[validFrom,setValidFrom]=useState(""),[validUntil,setValidUntil]=useState("");
 const [selected,setSelected]=useState<Channel[]>([]);
 const [pricing,setPricing]=useState<Price|null>(null),[priceLoading,setPriceLoading]=useState(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const imageRef=useRef<HTMLInputElement>(null);
 const refresh=useCallback(async()=>{
  const r=await request("/api/local/offers?business="+encodeURIComponent(businessId));
  const next=(r.offers||[]) as Offer[];setOffers(next);
  onCampaignsLoaded(next.flatMap(o=>(o.campaigns||[]).map(c=>c.id)),next.length);
  return next;
 },[businessId,onCampaignsLoaded]);
 const loadPricing=useCallback(async()=>{
  setPriceLoading(true);
  try{
   const response=await request("/api/local/offers/pricing?business="+encodeURIComponent(businessId));
   const next=response as unknown as Price;setPricing(next);return next;
  }finally{setPriceLoading(false)}
 },[businessId]);
 useEffect(()=>{
  let alive=true;setOffers([]);setShowEditor(false);setError("");setPricing(null);
  void Promise.all([refresh(),loadPricing()]).then(([,p])=>{
   if(alive)setSelected(channels.filter(([ch])=>readyPrice(p.channels[ch])).slice(0,1).map(([ch])=>ch));
  }).catch(e=>{if(alive)setError((e as Error).message)});
  return()=>{alive=false};
 },[refresh,loadPricing]);
 function toggle(channel:Channel){
  setSelected(current=>current.includes(channel)?current.filter(c=>c!==channel):[...current,channel]);
 }
 const selectedTotal=useMemo(()=>selected.reduce((sum,ch)=>sum+Number(pricing?.channels[ch]?.total_cents||0),0),[selected,pricing]);
 const currency=pricing?.channels[selected[0]]?.currency||"MXN";
 function totalFor(chs:Channel[],price:Price){
  if(!chs.length||chs.some(ch=>!readyPrice(price.channels[ch])))throw new Error("Selecciona canales disponibles con destinatarios.");
  const codes=new Set(chs.map(ch=>price.channels[ch].currency));
  if(codes.size!==1)throw new Error("Los canales deben utilizar la misma moneda.");
  return chs.reduce((sum,ch)=>sum+Number(price.channels[ch].total_cents),0);
 }
 async function deliver(offerId:string,campaignsToSend:Campaign[]){
  // Enviar lotes acotados: se puede reanudar sin confirmar ni facturar una segunda vez.
  let sent=0,failed=0,pending=false;
  for(const campaign of campaignsToSend){
   if(!isPending(campaign))continue;
   let current=campaign;
   for(let n=0;n<100;n++){
    if(!isPending(current))break;
    const result=await post(campaign.channel==="push"?"/api/local/push/send":"/api/local/marketing/send",{campaign_id:campaign.id});
    sent+=Number(result.sent||0);failed+=Number(result.failed||0);
    const status=await request("/api/local/offers/send?offer_id="+encodeURIComponent(offerId)) as unknown as SendState;
    current=status.campaigns.find(c=>c.id===campaign.id)||current;
   }
   if(isPending(current))pending=true;
  }
  setNotice("Campaña enviada: "+sent+" entregas aceptadas, "+failed+" rechazadas."+
   (pending?" Quedan envíos pendientes; puedes continuarlos desde la campaña.":""));
  await refresh();
 }
 async function sendOffer(offer:Offer){
  setBusy(true);setError("");setNotice("");
  try{
   const chs=(offer.campaigns||[]).map(c=>c.channel);
   if(!chs.length)throw new Error("La campaña no tiene canales disponibles.");
   let state:SendState;
   if(Number(offer.charged_channels||0)===0){
    const fresh=await loadPricing();
    const amount=totalFor(chs,fresh);
    const details=chs.map(ch=>{
     const r=fresh.channels[ch];
     return channels.find(x=>x[0]===ch)?.[1]+": "+r.recipients+" × "+money(Number(r.unit_price_cents),r.currency)+" = "+money(Number(r.total_cents),r.currency);
    });
    const message="¿Confirmar y enviar esta campaña?\n\n"+details.join("\n")+
     "\n\nPRECIO TOTAL DE LA CAMPAÑA: "+money(amount,fresh.channels[chs[0]].currency);
    if(!window.confirm(message))return;
    state=await post("/api/local/offers/send",{action:"confirm",offer_id:offer.id,expected_total_cents:amount}) as unknown as SendState;
   }else{
    state=await post("/api/local/offers/send",{action:"resume",offer_id:offer.id}) as unknown as SendState;
   }
   await deliver(offer.id,state.campaigns);
  }catch(e){setError((e as Error).message);await refresh().catch(()=>{});}
  finally{setBusy(false)}
 }
 async function create(e:React.FormEvent){
  e.preventDefault();setError("");setNotice("");
  if(!pricing||busy)return;
  let amount:number;
  try{amount=totalFor(selected,pricing)}catch(e){setError((e as Error).message);return;}
  const detail=selected.map(ch=>{
   const r=pricing.channels[ch];
   return channels.find(x=>x[0]===ch)?.[1]+": "+r.recipients+" × "+
    money(Number(r.unit_price_cents),r.currency)+" = "+money(Number(r.total_cents),r.currency);
  });
  // Esta confirmación inicia el envío. No se crea un borrador intermedio.
  if(!window.confirm("¿Enviar esta campaña ahora?\n\n"+detail.join("\n")+
   "\n\nPRECIO TOTAL DE LA CAMPAÑA: "+money(amount,currency)))return;
  setBusy(true);
  try{
   let image="";
   const photo=imageRef.current?.files?.[0];
   if(photo){
    if(photo.size>5*1024*1024||!["image/png","image/jpeg","image/webp"].includes(photo.type))
     throw new Error("La imagen debe ser JPG, PNG o WEBP, de hasta 5 MB.");
    const ext=photo.type==="image/png"?"png":photo.type==="image/webp"?"webp":"jpg";
    const key=businessId+"/oferta-"+crypto.randomUUID()+"."+ext;
    const uploaded=await db().storage.from("business-assets").upload(key,photo,{contentType:photo.type});
    if(uploaded.error)throw uploaded.error;
    image=new URL(db().storage.from("business-assets").getPublicUrl(key).data.publicUrl).pathname;
   }
   // Alta y confirmación del precio en una transacción: no requiere pulsar enviar otra vez.
   const created=await post("/api/local/offers",{
    action:"create_send",business_id:businessId,title:title.trim(),preview:preview.trim(),
    details:details.trim(),terms:kind==="offer"?terms.trim():"",kind,
    valid_from:kind==="offer"?validFrom||null:null,
    valid_until:kind==="offer"?validUntil||null:null,
    image_url:image||null,channels:selected,expected_total_cents:amount
   }) as {id?:string;campaigns?:Campaign[]};
   if(!created.id||!created.campaigns)throw new Error("No se pudo iniciar el envío.");
   setTitle("");setPreview("");setDetails("");setTerms("");setValidFrom("");setValidUntil("");setKind("offer");
   if(imageRef.current)imageRef.current.value="";
   setShowEditor(false);
   onCreated();
   await deliver(created.id,created.campaigns);
  }catch(e){setError((e as Error).message);await refresh().catch(()=>{});}
  finally{setBusy(false)}
 }
 return <section className="panel-card kreyv-offers-panel">
  <div className="content-heading"><div><h3>Tus campañas</h3>
   <p>Crea un mensaje y elige cómo lo reciben tus clientes.</p></div>
   <button type="button" className="button button-dark button-sm" disabled={busy} onClick={()=>{setShowEditor(v=>!v);setError("");setNotice("")}}>
    {showEditor?"Cerrar":"Crear nueva"} <Plus size={16}/></button>
  </div>
  {showEditor&&<form className="form-stack kreyv-offer-editor kreyv-campaign-form" onSubmit={create}>
   <div className="kreyv-editor-section"><span className="kreyv-editor-step">01</span><div><strong>¿Qué quieres comunicar?</strong><p>El aviso comunica una novedad; la oferta añade vigencia y condiciones.</p></div></div>
   <label>Tipo de campaña
    <select className="kreyv-campaign-kind" value={kind} onChange={e=>setKind(e.target.value as Kind)}>
     <option value="notice">Enviar aviso</option><option value="offer">Crear oferta</option>
    </select>
   </label>
   <label>Título <small>({title.length}/50)</small>
    <input required minLength={3} maxLength={50} value={title} onChange={e=>setTitle(e.target.value)}
     placeholder="¡2x1 en cafés este viernes!"/></label>
   <label>Texto breve de la notificación <small>({preview.length}/120)</small>
    <textarea required minLength={3} maxLength={120} rows={2} value={preview} onChange={e=>setPreview(e.target.value)}
     placeholder="Ven con un amigo y disfruta de la promoción."/></label>
   <label>Contenido completo <small>({details.length}/6000)</small>
    <textarea required minLength={3} maxLength={6000} rows={6} value={details} onChange={e=>setDetails(e.target.value)}
     placeholder="Explica la oferta para que los clientes puedan consultarla dentro de Kreyv."/></label>
   {kind==="offer"&&<div className="kreyv-campaign-validity">
    <div className="kreyv-editor-section"><span className="kreyv-editor-step">02</span><div><strong>Vigencia de la promoción</strong><p>Las fechas indican cuándo es válida la oferta; el aviso se envía al confirmar.</p></div></div>
    <div className="kreyv-campaign-dates">
     <label>Fecha de inicio<input type="date" value={validFrom} onChange={e=>setValidFrom(e.target.value)}/></label>
     <label>Fecha de fin<input type="date" min={validFrom||new Date().toISOString().slice(0,10)} value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></label>
    </div>
    <label>Condiciones (opcional)<textarea maxLength={1500} rows={3} value={terms}
     onChange={e=>setTerms(e.target.value)} placeholder="Por ejemplo, no acumulable con otras promociones."/></label>
   </div>}
   <label className="file-input"><ImagePlus size={18}/> Imagen de la campaña (opcional)
    <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp"/></label>
   <div className="kreyv-editor-section"><span className="kreyv-editor-step">{kind==="offer"?"03":"02"}</span><div><strong>Canales de envío</strong><p>Marca uno o varios destinos. Verás el precio exacto de cada uno.</p></div></div>
   <fieldset className="kreyv-offer-channels" aria-label="Canales de envío">
    {channels.map(([ch,name])=>{
     const r=pricing?.channels[ch];const enabled=readyPrice(r);
     return <label key={ch} className="kreyv-priced-channel">
      <input type="checkbox" checked={selected.includes(ch)} disabled={!enabled||busy}
       onChange={()=>toggle(ch)}/>
      <span className="kreyv-priced-channel-name">{ch==="push"?<BellRing size={18}/>:ch==="email"?<Mail size={18}/>:<Users size={18}/>}
       <strong>{name}</strong>
       <small>{r?.unit_price_cents==null?"Tarifa no configurada":money(r.unit_price_cents,r.currency)+" por envío"}</small>
      </span>
      <span className="kreyv-priced-channel-cost">
       {priceLoading?"Actualizando…":r?<>
        <b>{r.recipients} × {r.unit_price_cents!==null?money(r.unit_price_cents,r.currency):"—"}</b>
        <strong>{r.total_cents!==null?money(r.total_cents,r.currency):"—"}</strong>
        {!enabled&&<small>{r.recipients===0?"Sin destinatarios":!r.enabled?"Canal no disponible":""}</small>}
       </>:"Calculando…"}
      </span>
     </label>
    })}
   </fieldset>
   <div className="kreyv-price-summary"><div><span>Precio total de la campaña</span>
    <strong>{money(selectedTotal,currency)}</strong></div>
    <button className="button button-outline button-sm" type="button" disabled={busy||priceLoading}
     onClick={()=>void loadPricing().catch(e=>setError((e as Error).message))}><RefreshCcw size={15}/>Actualizar destinatarios</button>
   </div>
   <div className="kreyv-campaign-actions">
    <button type="submit" className="button button-dark" disabled={busy||priceLoading||!pricing||
     !selected.length||selected.some(ch=>!readyPrice(pricing?.channels[ch]))||
     title.trim().length<3||preview.trim().length<3||details.trim().length<3}>
     {busy?"Enviando campaña…":"Confirmar y enviar"} <ArrowUpRight size={16}/>
    </button>
   </div>
  </form>}
  {error&&<div className="alert error" role="alert">{error}</div>}
  {notice&&<div className="alert success" role="status"><Check size={17}/>{notice}</div>}
  {!!offers.length&&<div className="kreyv-offers-list">
   {offers.map(offer=>{
    const confirmed=Number(offer.charged_channels||0)>0;
    const pending=(offer.campaigns||[]).some(isPending);
    const done=(offer.campaigns||[]).length>0&&(offer.campaigns||[]).every(c=>["sent","partial","failed"].includes(c.status));
    const chs=(offer.campaigns||[]).map(c=>c.channel);
    const currentPrice=chs.reduce((sum,ch)=>sum+Number(pricing?.channels[ch]?.total_cents||0),0);
    return <article className="kreyv-offer-campaign" key={offer.id}>
     <div className="kreyv-offer-heading">{offer.image_url&&<img src={offer.image_url} alt="" loading="lazy"/>}
      <div><strong>{offer.title}</strong><p>{offer.preview}</p>
       <small>{kindLabels[offer.kind||"offer"]}{offer.valid_from?" · Desde "+offer.valid_from:""}{offer.valid_until?" · Hasta "+offer.valid_until:""}</small></div></div>
     <div className="kreyv-offer-campaign-channels">{(offer.campaigns||[]).map(c=>
      <span key={c.id}>{channels.find(x=>x[0]===c.channel)?.[1]} ·
       {c.status==="draft"?" Borrador":isPending(c)?" Enviando":c.status==="sent"?" Enviada":c.status==="partial"?" Parcial":" Fallida"}
       {c.status!=="draft"?" ("+Number(c.sent_count)+" aceptados)":""}</span>)}</div>
     <div className="kreyv-offer-campaign-bottom"><div>
      <small>{confirmed?"Precio total confirmado":"Precio total de la campaña"}</small>
      <strong>{money(confirmed?Number(offer.confirmed_cents):currentPrice,confirmed?(offer.confirmed_currency||currency):currency)}</strong>
     </div>
     {!done&&<button className="button button-dark button-sm" type="button" disabled={busy||priceLoading}
      onClick={()=>void sendOffer(offer)}>{busy?"Enviando…":confirmed&&pending?"Continuar envío":"Confirmar y enviar"} <ArrowUpRight size={15}/></button>}
     {done&&<span className="campaign-status campaign-status-sent">Envío finalizado</span>}
     </div>
    </article>;
   })}
  </div>}
  {!offers.length&&!showEditor&&<p className="muted">Todavía no hay campañas. Crea una para elegir los canales y consultar su precio.</p>}
 </section>;
}
