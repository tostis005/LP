"use client";
import {useEffect,useState,useRef} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import {useParams,useRouter} from "next/navigation";
import {ArrowUpRight,Gift,Heart,MapPin,Check,ArrowLeft,BellRing} from "lucide-react";
import {Brand} from "@/components/Brand";
import {logoImageUrl} from "@/lib/asset-images";
import {MerchantCard} from "@/components/StampCard";
import {publicJoinUrl} from "@/lib/public-url";
import {StampMark} from "@/components/StampMarks";
import {categoryStampKind} from "@/lib/business-categories";
import {programPromise,programExplanation} from "@/lib/program-presentation";
import type {Business,Location,Program} from "@/lib/types";
import {db,configured} from "@/lib/supabase";
const DirectoryMapView=dynamic(()=>import("@/components/DirectoryMap"),{ssr:false,loading:()=> <div className="map-placeholder">Preparando el mapa...</div>});
type PublicProgram=Pick<Program,"type"|"reward_label"|"reward_cost"|"cashback_bps"|"points_per_euro">;
type Offer={business_id:string;business_name:string;description:string|null;accent_color:string;reward_label:string;program_type:Program["type"];reward_cost:number;cashback_bps:number;points_per_euro:number;category:string|null;logo_url:string|null;card_text:string|null;card_text_color:string;stamp_color:string;stamp_icon:string;public_listing:boolean;locations_json:Location[]};
export default function JoinPage(){
 const params=useParams<{slug:string}>(),router=useRouter();
 const [offer,setOffer]=useState<Offer|null>(null),[business,setBusiness]=useState<Business|null>(null);
 const [program,setProgram]=useState<PublicProgram|null>(null),[locations,setLocations]=useState<Location[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [membershipId,setMembershipId]=useState("");
 const [signed,setSigned]=useState(false),[isBusinessAccount,setIsBusinessAccount]=useState(false),[joined,setJoined]=useState(false),[success,setSuccess]=useState(false),[marketing,setMarketing]=useState(false),[phone,setPhone]=useState(""),[savedPhone,setSavedPhone]=useState(""),[globalConsent,setGlobalConsent]=useState<boolean|null>(null);
 useEffect(()=>{let alive=true;async function load(){
  if(!configured()){setError("No se ha podido conectar con KREYVI.");setLoading(false);return}
  const [o,u,assets]=await Promise.all([db().rpc("public_business_details",{p_slug:params.slug}),db().auth.getUser(),db().rpc("public_business_card_assets",{p_slug:params.slug})]);
  if(!alive)return;
  setSigned(!!u.data.user);
  if(u.data.user){const existing=u.data.user.user_metadata?.whatsapp||"";setPhone(existing);setSavedPhone(existing)}
  if(o.error||!o.data?.length){setError("No hemos encontrado un programa disponible con este enlace.");setLoading(false);return}
  const found=o.data[0] as Offer;setOffer(found);
  setBusiness({
   id:found.business_id,name:found.business_name,slug:params.slug,description:found.description,
   category:found.category,accent_color:found.accent_color,logo_url:found.logo_url,
   card_text:found.card_text,card_text_color:found.card_text_color,stamp_color:found.stamp_color,
   stamp_icon:found.stamp_icon,stamp_image_url:assets.data?.[0]?.stamp_image_url||null,card_background:assets.data?.[0]?.card_background||null,card_logo_scale:assets.data?.[0]?.card_logo_scale??100,card_logo_x:assets.data?.[0]?.card_logo_x??0,card_logo_y:assets.data?.[0]?.card_logo_y??0,
   public_listing:found.public_listing,active:true
  });
  setProgram({type:found.program_type,reward_label:found.reward_label,reward_cost:found.reward_cost,cashback_bps:found.cashback_bps,points_per_euro:found.points_per_euro});
  setLocations(Array.isArray(found.locations_json)?found.locations_json:[]);
  if(u.data.user){
   const [m,roles,admin,defaultChoice]=await Promise.all([
    db().from("loyalty_memberships").select("id").eq("business_id",found.business_id).eq("customer_id",u.data.user.id).maybeSingle(),
    db().from("business_members").select("id").eq("user_id",u.data.user.id).eq("active",true).limit(1),
    db().from("platform_admins").select("user_id").eq("user_id",u.data.user.id).maybeSingle(),
    db().from("marketing_consents").select("global_business_opt_in").eq("customer_id",u.data.user.id).is("business_id",null).maybeSingle()
   ]);
   if(alive){setJoined(!!m.data);setMembershipId(m.data?.id||"");setIsBusinessAccount(!!admin.data||!!roles.data?.length);setGlobalConsent(defaultChoice.data?.global_business_opt_in??(u.data.user?.user_metadata?.card_notifications_opt_in===true?true:u.data.user?.user_metadata?.card_notifications_opt_in===false?false:null));}
  }
  if(alive)setLoading(false);
 }load();return()=>{alive=false}},[params.slug]);
 async function join(){
  if(!offer||busy)return;
  if(isBusinessAccount){setError("Para guardar tarjetas necesitas una cuenta de cliente.");return;}
  if(!signed){window.localStorage.setItem("lp_pending_join",offer.business_id);router.push("/acceder?next="+encodeURIComponent("/unirse/"+params.slug+"?alta=1"));return;}
  // Una sola acción inscribe la tarjeta; el consentimiento comercial es voluntario
  // y está desmarcado de origen. El permiso del sistema push es siempre explícito.
  const accepted=globalConsent===null?marketing:globalConsent;
  if(accepted&&globalConsent===null&&!/^\+[1-9][0-9]{7,14}$/.test((phone||savedPhone).trim())){
   setError("Para recibir avisos por WhatsApp, añade tu número con prefijo internacional.");
   return;
  }
  setBusy(true);setError("");
  try{
   if(globalConsent===null&&accepted&&phone.trim()&&phone.trim()!==savedPhone){
    const update=await db().auth.updateUser({whatsapp:phone.trim()});
    if(update.error)throw update.error;
    setSavedPhone(phone.trim());
   }
   const result=await db().rpc("join_program_with_notifications",{
    p_business:offer.business_id,p_opted_in:accepted
   });
   if(result.error)throw result.error;
   window.localStorage.removeItem("lp_pending_join");
   setJoined(true);setSuccess(true);
   const id=String(result.data||"");
   router.replace("/app"+(/^[a-f0-9-]{36}$/i.test(id)?"?card="+encodeURIComponent(id):""));
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 const autoJoinAttempted=useRef(false);
 useEffect(()=>{
  if(loading||!offer||!signed||isBusinessAccount||joined||busy||autoJoinAttempted.current)return;
  if(new URLSearchParams(window.location.search).get("alta")!=="1"||globalConsent===null)return;
  // A scanned URL alone must never create a membership. The prior explicit click is required.
  if(window.localStorage.getItem("lp_pending_join")!==offer.business_id)return;
  autoJoinAttempted.current=true;
  window.localStorage.removeItem("lp_pending_join");
  void join();
 },[loading,offer,signed,isBusinessAccount,joined,busy,globalConsent]);
 const category=business?.category||null;
 const offerProgram=program|| (offer?{type:offer.program_type,reward_label:offer.reward_label}:null);
 const hasLocation=locations.length>0;
 return <div className="join-page join-page-rich">
  <div className="join-top"><Brand/><Link href="/app/descubrir" className="text-link"><ArrowLeft size={16}/> Explorar negocios</Link></div>
  {loading?<div className="join-box"><div className="loading-screen">Descubriendo este negocio...</div></div>:!offer?<div className="join-box"><div className="empty-state"><h2>Este enlace no está disponible</h2><p>{error}</p></div></div>:
   <main className="join-detail">
    <div className="join-detail-main">
     <div className="join-business-hero">
      <div className="join-business-illustration" style={{backgroundColor:offer.logo_url?"#ffffff":offer.accent_color||"var(--color-brand)",color:offer.card_text_color||"#ffffff"}}>{offer.logo_url?<img src={logoImageUrl(offer.logo_url,192)} alt="" decoding="async"/>:<StampMark kind={business?.stamp_icon||categoryStampKind(category)} size={36}/>}</div>
      <div className="join-business-identity">
      <span className="join-business-category">{category||"Negocio local"}</span>
      <h1>{offer.business_name}</h1>
      </div>
      <div className="join-reward-large"><Gift size={21}/><strong>{programPromise(offerProgram)}</strong></div>
     </div>
     <section className="join-action-panel" aria-label="Conseguir mi tarjeta">
      {isBusinessAccount?<div className="info-callout"><Heart size={19}/><div><strong>Esta ficha es para tus clientes</strong><p>Estás dentro con una cuenta de negocio. Para guardar tarjetas y premios, utiliza una cuenta de cliente independiente.</p><Link href="/negocio">Volver a mi negocio <ArrowUpRight size={16}/></Link></div></div>:
      success||joined?<div className="join-subscribed"><Check size={20}/><div><strong>¡Ya tienes tu tarjeta!</strong><p>La encontrarás junto a tus demás tarjetas. Puedes abrirla, enseñarla en el negocio o guardarla en tu dispositivo.</p></div><div className="join-subscribed-links"><Link href={"/app"+(membershipId?"?card="+encodeURIComponent(membershipId):"")} className="button button-dark">Abrir mi tarjeta <ArrowUpRight size={16}/></Link></div></div>:
      <div className="join-subscribe">
       <h2>Tu tarjeta, en el móvil</h2>
       <p>Consíguela gratis y empieza a disfrutar de tus recompensas.</p>
       {signed&&globalConsent===null&&<>
        <label className="join-marketing-choice join-unified-promo">
         <input type="checkbox" checked={marketing} onChange={e=>{setMarketing(e.target.checked);setError("")}}/>
         <span><strong><BellRing size={17}/> Quiero recibir ofertas y novedades</strong>
          <small>No te pierdas las promociones de los locales participantes. Puedes cambiar tus preferencias en Ajustes.</small><details><summary>Más información</summary><small>De tus tarjetas actuales y futuras, por correo electrónico, WhatsApp y notificaciones push. Es opcional.</small></details>
         </span>
        </label>
        {marketing&&(!/^\+[1-9][0-9]{7,14}$/.test(savedPhone))&&
         <label className="join-phone-field">Tu número de WhatsApp (con prefijo del país)
          <input type="tel" inputMode="tel" required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+526641234567" pattern="[+][1-9][0-9]{7,14}"/>
          <small>Necesario para habilitar también WhatsApp. Puedes cambiarlo en Mi perfil.</small>
         </label>}
       </>}
       {error&&<div className="alert error" role="alert">{error}</div>}
       <button disabled={busy} onClick={()=>void join()} className="button button-dark button-full">{busy?"Preparando tu tarjeta...":signed?"Añadir mi tarjeta":"Conseguir mi tarjeta gratis"} <ArrowUpRight size={17}/></button>
      </div>}
     </section>
     <section className="join-info-panel">
      <span className="eyebrow">UNA BUENA VISITA MERECE UN PREMIO</span>
      <h2>Así funciona su programa</h2>
      {offer.description&&<p className="join-business-description">{offer.description}</p>}
      <p>{programExplanation(offerProgram)}</p>
      {business&&program&&<div className="join-card-preview">
       <MerchantCard business={business} program={program} balance={0} qrValue={publicJoinUrl(params.slug)}/>
       <small>Así será tu tarjeta al comenzar. Cada visita te acercará a tu premio.</small>
      </div>}

     </section>
    </div>
    <aside className="join-detail-side">
     <section className="join-side-card"><div className="panel-icon"><MapPin size={21}/></div><h2>¿Dónde está?</h2>
      {hasLocation?locations.map(l=><div className="join-address" key={l.id}><strong>{l.name}</strong><span>{l.address}</span><span>{l.city}, {l.country}</span><a target="_blank" rel="noopener noreferrer" href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(l.lat+","+l.lng)}>Cómo llegar <ArrowUpRight size={14}/></a></div>):<p>Este negocio todavía no ha añadido una dirección pública.</p>}
     </section>
     {hasLocation&&<div className="join-mini-map"><DirectoryMapView locations={locations.map(l=>({...l,businesses:{name:offer.business_name,category,slug:params.slug,accent_color:offer.accent_color,stamp_icon:offer.stamp_icon,stamp_color:offer.stamp_color},offerText:programPromise(offerProgram)}))} center={[locations[0].lat,locations[0].lng]}/></div>}
     <section className="join-side-card"><Heart size={23}/><h3>Cada visita tiene algo bueno</h3><p>Descubre negocios, elige tus favoritos y lleva todas tus tarjetas en Kreyvi.</p><Link href="/app/descubrir">Seguir explorando <ArrowUpRight size={15}/></Link></section>
    </aside>
   </main>
  }
 </div>;
}
