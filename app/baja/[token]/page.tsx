import {Brand} from "@/components/Brand";
export default async function Unsubscribe({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const valid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(token);
 return <main className="join-page"><div className="join-card"><Brand/><h1>¿Quieres dejar de recibir promociones?</h1><p>Si confirmas, este negocio dejará de enviarte comunicaciones comerciales. Seguirás disfrutando de tus tarjetas y recompensas.</p>
 {valid?<form method="post" action="/api/local/marketing/unsubscribe"><input type="hidden" name="token" value={token}/><button className="button button-dark button-full">Confirmar baja de promociones</button></form>:<p>El enlace no es válido.</p>}
 </div></main>;
}
