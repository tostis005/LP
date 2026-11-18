"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import {ArrowUpRight,Gift,Heart} from "lucide-react";
import {Brand} from "@/components/Brand";
import {db,configured} from "@/lib/supabase";
type Offer={business_id:string;business_name:string;description:string|null;accent_color:string;reward_label:string;program_type:string};
export default function JoinPage(){
 const params=useParams<{slug:string}>(),router=useRouter(),[offer,setOffer]=useState<Offer|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(false),[signed,setSigned]=useState(false);
 useEffect(()=>{async function load(){if(!configured()){setError("No se ha podido conectar con LP");setLoading(false);return}
  const [o,u]=await Promise.all([db().rpc("find_join_business",{p_slug:params.slug}),db().auth.getUser()]);
  setSigned(!!u.data.user);if(o.error||!o.data?.length)setError("No hemos encontrado un programa activo con este enlace.");else setOffer(o.data[0] as Offer);setLoading(false)
 }load()},[params.slug]);
 async function join(){if(!offer)return;
  if(!signed){window.localStorage.setItem("lp_pending_join",offer.business_id);router.push("/acceder");return}
  setBusy(true);setError("");const {error}=await db().rpc("join_program",{p_business:offer.business_id});
  setBusy(false);if(error)setError(error.message);else setSuccess(true)
 }
 return <div className="join-page"><div className="join-top"><Brand/><Link href="/" className="text-link">Inicio <ArrowUpRight size={16}/></Link></div><div className="join-box">
  <div className="join-badge"><Heart size={17}/> ESTÁS INVITADO</div>
  {loading?<div className="loading-screen">Buscando tu invitación...</div>:!offer?<div className="empty-state"><h2>Este enlace no está disponible</h2><p>{error}</p></div>:<>
  <div className="join-visual" style={{background:offer.accent_color||"#264d3e"}}><span>LOYALTY CLUB ♡</span><div><small>UNA TARJETA PARA VOLVER</small><h1>{offer.business_name}</h1></div><span>● ● ● ○ ○ ○</span></div>
  {success?<><h2>¡Ya formas parte! ♡</h2><p>Tu tarjeta personal te está esperando.</p><Link className="button button-dark button-full" href="/app">Ver mis tarjetas <ArrowUpRight size={17}/></Link></>:<><h2>Unirte tiene recompensa.</h2><p>{offer.description||"Cada visita es una oportunidad de recibir algo especial."}</p><div className="join-reward"><Gift size={19}/><span>{offer.reward_label}</span></div>{error&&<div className="alert error">{error}</div>}<button disabled={busy} onClick={join} className="button button-dark button-full">{busy?"Inscribiendo...":signed?"Quiero mi tarjeta":"Entrar para conseguir mi tarjeta"} <ArrowUpRight size={17}/></button><div className="tiny-note">Una cuenta para todos tus negocios favoritos. El consentimiento para recibir marketing es opcional y se configura por separado.</div></>}
  </>}
 </div></div>;
}
