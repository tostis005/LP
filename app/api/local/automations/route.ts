import {actorFromRequest,asActor,checkOrigin,responseError,ApiError} from "@/lib/server/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
type Input={
 action?:"create"|"toggle"; business_id?:string;rule_id?:string;active?:boolean;
 name?:string;trigger_kind?:"signup"|"stamps";delay_days?:number;
 target_stamps?:number;window_days?:number;staff_instruction?:string;
 title?:string;preview?:string;details?:string
};
const trim=(s:unknown)=>typeof s==="string"?s.trim():"";
export async function GET(request:Request){
 try{
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Inicia sesión.",401);
  const business=new URL(request.url).searchParams.get("business")||"";
  if(!uuid.test(business))throw new ApiError("Negocio inválido.");
  const rows=await asActor(actor,async client=>{
   const allowed=await client.query<{allowed:boolean}>("SELECT public.is_business_manager($1::uuid) AS allowed",[business]);
   if(!allowed.rows[0]?.allowed)throw new ApiError("No autorizado.",403);
   return (await client.query(
    "SELECT r.id,r.name,r.trigger_kind,r.delay_days,r.target_stamps,r.window_days,r.staff_instruction,r.active,r.created_at,"+
    "o.title,o.preview,o.details FROM public.automation_rules r "+
    "JOIN public.business_offers o ON o.id=r.offer_id "+
    "WHERE r.business_id=$1::uuid ORDER BY r.created_at DESC LIMIT 75",[business])).rows;
  });
  return Response.json({rules:rows},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e)}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Inicia sesión.",401);
  const raw=await request.text();
  if(raw.length>10000)throw new ApiError("Solicitud demasiado larga.",413);
  const input=JSON.parse(raw) as Input;
  const business=input.business_id||"";
  if(!uuid.test(business))throw new ApiError("Negocio inválido.");
  if(input.action!=="create"&&input.action!=="toggle")throw new ApiError("Acción inválida.");
  if(input.action==="toggle"){
   if(!uuid.test(input.rule_id||"")||typeof input.active!=="boolean")throw new ApiError("Regla inválida.");
   await asActor(actor,async client=>{
    const result=await client.query(
     "UPDATE public.automation_rules SET active=$1,updated_at=now() "+
     "WHERE id=$2::uuid AND business_id=$3::uuid RETURNING id",
     [input.active,input.rule_id,business]);
    if(!result.rowCount)throw new ApiError("No puedes cambiar esta automatización.",403);
   });
   return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  }
  const name=trim(input.name),title=trim(input.title),preview=trim(input.preview),
   details=trim(input.details),instruction=trim(input.staff_instruction);
  const trigger=input.trigger_kind,days=Number(input.delay_days),stamps=Number(input.target_stamps),window=Number(input.window_days);
  if(name.length<3||name.length>70||title.length<3||title.length>50||
   preview.length<3||preview.length>120||details.length<3||details.length>6000||
   !Number.isInteger(days)||days<0||days>90||!["signup","stamps"].includes(trigger||""))
   throw new ApiError("Revisa el nombre, mensaje y días de espera.");
  if(trigger==="stamps"&&(!Number.isInteger(stamps)||stamps<1||stamps>100||
   !Number.isInteger(window)||window<1||window>365||instruction.length>250))
   throw new ApiError("Indica un umbral de sellos y una vigencia válida.");
  if(trigger==="signup"&&instruction)throw new ApiError("La instrucción de caja solo se utiliza con sellos.");
  const id=await asActor(actor,async client=>{
   const allowed=await client.query<{allowed:boolean}>(
    "SELECT public.is_business_manager($1::uuid) AS allowed",[business]);
   if(!allowed.rows[0]?.allowed)throw new ApiError("No autorizado.",403);
   if(trigger==="stamps"){
    const p=await client.query<{type:string}>(
     "SELECT type FROM public.loyalty_programs WHERE business_id=$1::uuid",[business]);
    if(p.rows[0]?.type!=="stamps")throw new ApiError("Los hitos de sellos requieren una tarjeta de sellos.");
   }
   const count=await client.query<{n:number}>(
    "SELECT count(*)::integer n FROM public.automation_rules WHERE business_id=$1::uuid",[business]);
   if(count.rows[0].n>=30)throw new ApiError("Puedes crear hasta 30 automatizaciones por negocio.");
   const o=await client.query<{id:string}>(
    "INSERT INTO public.business_offers(business_id,created_by,title,preview,details,kind) "+
    "VALUES($1::uuid,$2::uuid,$3,$4,$5,'notice') RETURNING id",
    [business,actor.id,title,preview,details]);
   const rule=await client.query<{id:string}>(
    "INSERT INTO public.automation_rules(business_id,created_by,offer_id,name,trigger_kind,delay_days,target_stamps,window_days,staff_instruction) "+
    "VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9) RETURNING id",
    [business,actor.id,o.rows[0].id,name,trigger,days,trigger==="stamps"?stamps:null,
     trigger==="stamps"?window:null,trigger==="stamps"?instruction:""]);
   return rule.rows[0].id;
  });
  return Response.json({id},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e)}
}
