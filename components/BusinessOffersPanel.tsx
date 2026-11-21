"use client";
import {useCallback,useEffect,useState} from "react";
import {ArrowUpRight,BellRing,Check,ImagePlus,Mail,Plus,Users} from "lucide-react";
import {db} from "@/lib/supabase";
type Channel="email"|"whatsapp"|"push";
type Offer={id:string;title:string;preview:string;valid_until:string|null;image_url:string|null;
 created_at:string;delivered:number};
async function request(path:string,init?:RequestInit){
 const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...init});
 const result=await response.json() as {error?:string;[key:string]:unknown};
 if(!response.ok||result.error)throw new Error(result.error||"No se pudo completar la operación.");
 return result;
}
export function BusinessOffersPanel({businessId,channelsEnabled,onCreated}:{
 businessId:string;channelsEnabled:{email:boolean;whatsapp:boolean;push:boolean};onCreated:()=>void;
}){
 const [offers,setOffers]=useState<Offer[]>([]),[open,setOpen]=useState(false);
 const [title,setTitle]=useState(""),[preview,setPreview]=useState(""),[details,setDetails]=useState("");
 const [terms,setTerms]=useState(""),[validUntil,setValidUntil]=useState("");
 const [channels,setChannels]=useState<Channel[]>([]);
 useEffect(()=>{setChannels(channelsEnabled.push?["push"]:channelsEnabled.email?["email"]:channelsEnabled.whatsapp?["whatsapp"]:[])},[businessId,channelsEnabled.push,channelsEnabled.email,channelsEnabled.whatsapp]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{const r=await request("/api/local/offers?business="+encodeURIComponent(businessId));setOffers((r.offers||[]) as Offer[])},[businessId]);
 useEffect(()=>{setOpen(false);setError("");void refresh().catch(e=>setError((e as Error).message))},[refresh]);
 function toggle(channel:Channel){setChannels(current=>current.includes(channel)?current.filter(x=>x!==channel):[...current,channel]);}
 async function create(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setNotice("");
  try{
   if(!channels.length)throw new Error("Selecciona al menos un canal.");
   let image="";
   const file=document.getElementById("kreyv-offer-image") as HTMLInputElement|null;
   const photo=file?.files?.[0];
   if(photo){
    if(photo.size>5*1024*1024||!["image/png","image/jpeg","image/webp"].includes(photo.type))
     throw new Error("La imagen debe ser JPG, PNG o WEBP y pesar menos de 5 MB.");
    const ext=photo.type==="image/png"?"png":photo.type==="image/webp"?"webp":"jpg";
    const key=businessId+"/oferta-"+crypto.randomUUID()+"."+ext;
    const upload=await db().storage.from("business-assets").upload(key,photo,{contentType:photo.type});
    if(upload.error)throw upload.error;
    image=new URL(db().storage.from("business-assets").getPublicUrl(key).data.publicUrl).pathname;
   }
   const result=await request("/api/local/offers",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"create",business_id:businessId,title:title.trim(),preview:preview.trim(),
     details:details.trim(),terms:terms.trim(),valid_until:validUntil||null,image_url:image||null,channels})});
   if(!result.id)throw new Error("No se pudo guardar la oferta.");
   setTitle("");setPreview("");setDetails("");setTerms("");setValidUntil("");
   setOpen(false);setChannels(channelsEnabled.push?["push"]:channelsEnabled.email?["email"]:channelsEnabled.whatsapp?["whatsapp"]:[]);setNotice("Oferta guardada. Revisa las campañas creadas y confirma cada envío desde «Todas tus campañas».");
   await refresh();onCreated();
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 return <section className="panel-card kreyv-offers-panel">
  <div className="content-heading">
   <div><h3>Ofertas y novedades</h3><p>Crea una oferta completa una sola vez y prepara sus envíos por los canales que elijas.</p></div>
   <button type="button" className="button button-dark button-sm" onClick={()=>setOpen(v=>!v)}>
    {open?"Cerrar":"Nueva oferta"} <Plus size={16}/></button>
  </div>
  {open&&<form className="form-stack kreyv-offer-editor" onSubmit={create}>
   <label>Título de la notificación <small>({title.length}/50)</small>
    <input required minLength={3} maxLength={50} value={title} onChange={e=>setTitle(e.target.value)}
     placeholder="¡2x1 en cafés este viernes!"/></label>
   <label>Resumen breve <small>({preview.length}/120)</small>
    <textarea required minLength={3} maxLength={120} rows={2} value={preview} onChange={e=>setPreview(e.target.value)}
     placeholder="Ven con un amigo y disfrutad de nuestra promoción."/></label>
   <label>Detalle completo de la oferta <small>({details.length}/6000)</small>
    <textarea required minLength={3} maxLength={6000} rows={7} value={details} onChange={e=>setDetails(e.target.value)}
     placeholder="Explica aquí en qué consiste la promoción y cómo aprovecharla."/></label>
   <label>Condiciones (opcional)
    <textarea maxLength={1500} rows={3} value={terms} onChange={e=>setTerms(e.target.value)}
     placeholder="Por ejemplo, no acumulable con otras promociones."/></label>
   <label>Válida hasta (opcional)
    <input type="date" min={new Date().toISOString().slice(0,10)} value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></label>
   <label className="file-input"><ImagePlus size={18}/> Añadir imagen (opcional, máximo 5 MB)
    <input id="kreyv-offer-image" type="file" accept="image/png,image/jpeg,image/webp"/></label>
   <fieldset className="kreyv-offer-channels">
    <legend>Preparar campañas para</legend>
    {(["push","email","whatsapp"] as Channel[]).map(ch=><label key={ch}>
     <input type="checkbox" checked={channels.includes(ch)} disabled={!channelsEnabled[ch]||busy} onChange={()=>toggle(ch)}/>
     {ch==="push"?<BellRing size={16}/>:ch==="email"?<Mail size={16}/>:<Users size={16}/>}
     {ch==="push"?"Push":ch==="email"?"Correo":"WhatsApp"} {!channelsEnabled[ch]&&<small>(No disponible)</small>}
    </label>)}
   </fieldset>
   <p className="tiny-note">La oferta se mostrará en «Novedades» de cada cliente cuando el proveedor acepte su envío. No se enviará nada hasta que confirmes cada campaña.</p>
   <button type="submit" className="button button-dark" disabled={busy||!channels.length||title.trim().length<3||preview.trim().length<3||details.trim().length<3}>
    {busy?"Guardando...":"Guardar oferta y preparar campañas"} <Check size={16}/></button>
  </form>}
  {notice&&<div className="alert success" role="status">{notice}</div>}
  {error&&<div className="alert error" role="alert">{error}</div>}
  {offers.length>0&&<div className="kreyv-offers-list">{offers.map(offer=><article className="kreyv-offers-row" key={offer.id}>
   {offer.image_url&&<img src={offer.image_url} alt="" loading="lazy"/>}
   <div><strong>{offer.title}</strong><p>{offer.preview}</p><small>{offer.valid_until?"Válida hasta "+offer.valid_until:"Sin fecha límite"}</small></div>
  </article>)}</div>}
  {!offers.length&&!open&&<p className="muted">Todavía no tienes ofertas creadas.</p>}
 </section>;
}
