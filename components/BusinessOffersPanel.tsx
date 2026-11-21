"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {ArrowUpRight,BellRing,Check,ImagePlus,Mail,Plus,RefreshCcw,Users} from "lucide-react";
import {db} from "@/lib/supabase";
type Channel="email"|"whatsapp"|"push";
type Rate={recipients:number;unit_price_cents:number|null;total_cents:number|null;currency:string;enabled:boolean};
type Price={channels:Record<Channel,Rate>};
type Campaign={id:string;channel:Channel;status:string;recipient_count:number;sent_count:number;failed_count:number};
type Offer={id:string;title:string;preview:string;image_url:string|null;valid_until:string|null;
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
 const [terms,setTerms]=useState(""),[validUntil,setValidUntil]=useState("");
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
 const currency=pricing?.channels.email?.currency||pricing?.channels.push?.currency||"MXN";
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
  setNotice("Campaña procesada: "+sent+" entregas aceptadas, "+failed+" rechazadas."+
   (pending?" Quedan destinatarios pendientes; utiliza «Continuar envío».":"")+
   " El importe confirmado está registrado en Facturación.");
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
     "\n\nTOTAL A FACTURAR: "+money(amount,fresh.channels[chs[0]].currency)+
     "\n\nEs un precio cerrado por destinatarios incluidos en el envío; no disminuye si algún proveedor rechaza el mensaje. Quedará registrado para la próxima factura.";
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
  if(!pricing)return;
  let amount:number;
  try{amount=totalFor(selected,pricing)}catch(e){setError((e as Error).message);return;}
  const detail=selected.map(ch=>{
   const r=pricing.channels[ch];
   return channels.find(x=>x[0]===ch)?.[1]+": "+r.recipients+" × "+money(Number(r.unit_price_cents),r.currency)+" = "+money(Number(r.total_cents),r.currency);
  });
  if(!window.confirm("Guardar y confirmar el envío de esta campaña?\n\n"+detail.join("\n")+
   "\n\nTOTAL A FACTURAR: "+money(amount,currency)+
   "\n\nSe cobra por los destinatarios incluidos al confirmar, aunque el proveedor rechace algún envío. El precio se registra para la factura."))return;
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
   const created=await post("/api/local/offers",{action:"create",business_id:businessId,title:title.trim(),preview:preview.trim(),
    details:details.trim(),terms:terms.trim(),valid_until:validUntil||null,image_url:image||null,channels:selected});
   const id=String(created.id||"");
   if(!id)throw new Error("No se pudo crear la campaña.");
   setTitle("");setPreview("");setDetails("");setTerms("");setValidUntil("");
   if(imageRef.current)imageRef.current.value="";
   setShowEditor(false);
   onCreated();
   // Verificación del importe en servidor; cambios de tarifa o audiencia detienen el envío sin cargo.
   const state=await post("/api/local/offers/send",{action:"confirm",offer_id:id,expected_total_cents:amount}) as unknown as SendState;
   await deliver(id,state.campaigns);
  }catch(e){setError((e as Error).message);await refresh().catch(()=>{});}
  finally{setBusy(false)}
 }
 return <section className="panel-card kreyv-offers-panel">
  <div className="content-heading"><div><h3>Campañas</h3>
   <p>Redacta una vez, elige los canales y confirma un único total de facturación.</p></div>
   <button type="button" className="button button-dark button-sm" disabled={busy} onClick={()=>{setShowEditor(v=>!v);setError("");setNotice("")}}>
    {showEditor?"Cerrar":"Crear campaña"} <Plus size={16}/></button>
  </div>
  {showEditor&&<form className="form-stack kreyv-offer-editor" onSubmit={create}>
   <label>Título <small>({title.length}/50)</small>
    <input required minLength={3} maxLength={50} value={title} onChange={e=>setTitle(e.target.value)}
     placeholder="¡2x1 en cafés este viernes!"/></label>
   <label>Resumen para la notificación <small>({preview.length}/120)</small>
    <textarea required minLength={3} maxLength={120} rows={2} value={preview} onChange={e=>setPreview(e.target.value)}
     placeholder="Ven con un amigo y disfruta de la promoción."/></label>
   <label>Detalle completo de la oferta <small>({details.length}/6000)</small>
    <textarea required minLength={3} maxLength={6000} rows={6} value={details} onChange={e=>setDetails(e.target.value)}
     placeholder="Explica la oferta para que los clientes puedan consultarla dentro de Kreyv."/></label>
   <label>Condiciones (opcional)<textarea maxLength={1500} rows={3} value={terms}
    onChange={e=>setTerms(e.target.value)} placeholder="Por ejemplo, no acumulable."/></label>
   <label>Validez (opcional)<input type="date" min={new Date().toISOString().slice(0,10)}
    value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></label>
   <label className="file-input"><ImagePlus size={18}/> Imagen de la campaña (opcional)
    <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp"/></label>
   <fieldset className="kreyv-offer-channels">
    <legend>¿Dónde quieres enviar la campaña?</legend>
    {channels.map(([ch,name])=>{
     const r=pricing?.channels[ch];const enabled=readyPrice(r);
     return <label key={ch} className="kreyv-priced-channel">
      <input type="checkbox" checked={selected.includes(ch)} disabled={!enabled||busy}
       onChange={()=>toggle(ch)}/>
      <span className="kreyv-priced-channel-name">{ch==="push"?<BellRing size={18}/>:ch==="email"?<Mail size={18}/>:<Users size={18}/>}
       <strong>{name}</strong>
       <small>{r?.unit_price_cents==null?"Tarifa sin definir":money(r.unit_price_cents,r.currency)+" / destinatario"}</small>
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
   <div className="kreyv-price-summary"><div><span>Total de la campaña</span>
    <strong>{money(selectedTotal,currency)}</strong></div>
    <small>Importe cerrado al confirmar, según destinatarios y tarifas vigentes.
     Quedará pendiente de facturar. Los mensajes rechazados también se incluyen en el precio confirmado.</small>
    <button className="button button-outline button-sm" type="button" disabled={busy||priceLoading}
     onClick={()=>void loadPricing().catch(e=>setError((e as Error).message))}><RefreshCcw size={15}/>Actualizar destinatarios</button>
   </div>
   <button type="submit" className="button button-dark" disabled={busy||priceLoading||!pricing||
    !selected.length||selected.some(ch=>!readyPrice(pricing?.channels[ch]))||
    title.trim().length<3||preview.trim().length<3||details.trim().length<3}>
    {busy?"Preparando envío…":"Confirmar precio y enviar campaña"} <ArrowUpRight size={16}/></button>
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
       <small>{offer.valid_until?"Válida hasta "+offer.valid_until:"Sin fecha límite"}</small></div></div>
     <div className="kreyv-offer-campaign-channels">{(offer.campaigns||[]).map(c=>
      <span key={c.id}>{channels.find(x=>x[0]===c.channel)?.[1]} ·
       {c.status==="draft"?" Borrador":isPending(c)?" Enviando":c.status==="sent"?" Enviada":c.status==="partial"?" Parcial":" Fallida"}
       {c.status!=="draft"?" ("+Number(c.sent_count)+" aceptados)":""}</span>)}</div>
     <div className="kreyv-offer-campaign-bottom"><div>
      <small>{confirmed?"Cargo confirmado · pendiente de facturar":"Precio actual de la campaña"}</small>
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
