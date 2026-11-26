import {authPool,actorFromRequest,asActor,checkOrigin,ApiError,responseError} from "@/lib/server/db";
import {validateEmail} from "@/lib/server/auth";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
const topics=new Set(["wallet","card","account","rewards","privacy","other"]);
const text=(v:unknown)=>typeof v==="string"?v.trim():"";
export async function POST(request:Request){
 try{
  checkOrigin(request);const raw=await request.text();if(raw.length>12000)throw new ApiError("Solicitud demasiado larga.",413);
  const v=JSON.parse(raw);if(v.website) return Response.json({ok:true},{headers});
  const name=text(v.name),email=text(v.email).toLowerCase(),topic=text(v.topic),message=text(v.message);
  if(name.length<2||name.length>120||!validateEmail(email)||!topics.has(topic)||message.length<10||message.length>2000||v.consent!==true)throw new ApiError("Revisa los datos del formulario.");
  const result=await authPool.query("SELECT public.submit_support_request($1,$2,$3,$4) AS id",[name,email,topic,message]);
  return Response.json({ok:true,id:result.rows[0].id},{status:201,headers});
 }catch(e){return responseError(e);}
}
async function admin(request:Request){const actor=await actorFromRequest(request);if(!actor)throw new ApiError("Inicia sesión.",401);await asActor(actor,async c=>{if(!(await c.query("SELECT public.is_platform_admin() AS ok")).rows[0]?.ok)throw new ApiError("No autorizado.",403);});return actor;}
export async function GET(request:Request){try{const actor=await admin(request);const items=await asActor(actor,async c=>(await c.query("SELECT * FROM public.support_requests ORDER BY (status='new') DESC,created_at DESC LIMIT 250")).rows);return Response.json({items},{headers});}catch(e){return responseError(e);}}
export async function PATCH(request:Request){try{checkOrigin(request);const actor=await admin(request),v=await request.json();if(!/^[a-f0-9-]{36}$/i.test(v.id||"")||!["new","contacted","resolved"].includes(v.status))throw new ApiError("Datos no válidos.");await asActor(actor,async c=>{const r=await c.query("UPDATE public.support_requests SET status=$2 WHERE id=$1",[v.id,v.status]);if(r.rowCount!==1)throw new ApiError("Solicitud no encontrada.",404);});return Response.json({ok:true},{headers});}catch(e){return responseError(e);}}
