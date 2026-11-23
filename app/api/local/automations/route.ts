import {actorFromRequest,asActor,checkOrigin,responseError,ApiError} from "@/lib/server/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
type Input={
 action?:"create"|"toggle"|"edit"; business_id?:string;rule_id?:string;active?:boolean;
 name?:string;trigger_kind?:"signup"|"stamps"|"visits"|"no_visit"|"inactivity"|"first_redeem";delay_days?:number;
 target_stamps?:number;window_days?:number;target_visits?:number;inactivity_days?:number;staff_instruction?:string;
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
    "SELECT r.id,r.name,r.trigger_kind,r.delay_days,r.target_stamps,r.window_days,r.target_visits,r.inactivity_days,r.staff_instruction,r.active,r.created_at,"+
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
  if(!["create","toggle","edit"].includes(input.action||""))throw new ApiError("Acción inválida.");
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
  if(input.action==="edit"){
   if(!uuid.test(input.rule_id||""))throw new ApiError("Automatización inválida.");
   const name=trim(input.name),title=trim(input.title),preview=trim(input.preview),details=trim(input.details);
   if(name.length<3||name.length>70||title.length<3||title.length>50||
    preview.length<3||preview.length>120||details.length<3||details.length>6000)
    throw new ApiError("Comprueba el nombre y el contenido del mensaje.");
   await asActor(actor,async client=>{
    const existing=await client.query<{offer_id:string}>(
     "SELECT offer_id FROM public.automation_rules WHERE id=$1::uuid AND business_id=$2::uuid FOR UPDATE",
     [input.rule_id,business]);
    if(!existing.rowCount)throw new ApiError("Esta automatización no pertenece a tu negocio.",403);
    await client.query("UPDATE public.automation_rules SET name=$1,updated_at=now() WHERE id=$2::uuid",
     [name,input.rule_id]);
    await client.query("UPDATE public.business_offers SET title=$1,preview=$2,details=$3 WHERE id=$4::uuid AND business_id=$5::uuid",
     [title,preview,details,existing.rows[0].offer_id,business]);
   });
   return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  }
  const name=trim(input.name),title=trim(input.title),preview=trim(input.preview),
   details=trim(input.details),instruction=trim(input.staff_instruction);
  const trigger=input.trigger_kind,days=Number(input.delay_days),stamps=Number(input.target_stamps),window=Number(input.window_days),visits=Number(input.target_visits),inactivity=Number(input.inactivity_days);
  const kinds=["signup","stamps","visits","no_visit","inactivity","first_redeem"];
  if(name.length<3||name.length>70||title.length<3||title.length>50||
   preview.length<3||preview.length>120||details.length<3||details.length>6000||
   !kinds.includes(trigger||"")||!Number.isInteger(days)||days<0||days>90)
   throw new ApiError("Revisa el nombre, el disparador, los días y el mensaje.");
  if(trigger==="stamps"&&(!Number.isInteger(stamps)||stamps<1||stamps>1000000||
   !Number.isInteger(window)||window<1||window>365||instruction.length>250))
   throw new ApiError("Indica cuántos sellos y en qué plazo debe conseguirlos el cliente.");
  if(trigger==="visits"&&(!Number.isInteger(visits)||visits<1||visits>500))
   throw new ApiError("Selecciona un objetivo de entre 1 y 500 compras.");
  if((trigger==="inactivity"||trigger==="no_visit")&&
   (!Number.isInteger(inactivity)||inactivity<1||inactivity>365||days!==0))
   throw new ApiError("El periodo sin visitas debe estar entre 1 y 365 días.");
  if(trigger!=="stamps"&&instruction)throw new ApiError("La instrucción de caja solo se utiliza con sellos.");
  const id=await asActor(actor,async client=>{
   const allowed=await client.query<{allowed:boolean}>(
    "SELECT public.is_business_manager($1::uuid) AS allowed",[business]);
   if(!allowed.rows[0]?.allowed)throw new ApiError("No autorizado.",403);
   if(trigger==="stamps"){
    const p=await client.query<{type:string}>(
     "SELECT type FROM public.loyalty_programs WHERE business_id=$1::uuid",[business]);
    if(!p.rowCount)throw new ApiError("Configura primero el programa de fidelización.");
    if(p.rows[0].type==="stamps"&&stamps>100)throw new ApiError("El objetivo máximo es 100 sellos.");
   }
   const count=await client.query<{n:number}>(
    "SELECT count(*)::integer n FROM public.automation_rules WHERE business_id=$1::uuid",[business]);
   if(count.rows[0].n>=30)throw new ApiError("Puedes crear hasta 30 automatizaciones por negocio.");
   const o=await client.query<{id:string}>(
    "INSERT INTO public.business_offers(business_id,created_by,title,preview,details,kind) "+
    "VALUES($1::uuid,$2::uuid,$3,$4,$5,'notice') RETURNING id",
    [business,actor.id,title,preview,details]);
   const rule=await client.query<{id:string}>(
    "INSERT INTO public.automation_rules(business_id,created_by,offer_id,name,trigger_kind,delay_days,target_stamps,window_days,target_visits,inactivity_days,staff_instruction) "+
    "VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",
    [business,actor.id,o.rows[0].id,name,trigger,days,trigger==="stamps"?stamps:null,
     trigger==="stamps"?window:null,trigger==="visits"?visits:null,
     trigger==="no_visit"||trigger==="inactivity"?inactivity:null,trigger==="stamps"?instruction:""]);
   return rule.rows[0].id;
  });
  return Response.json({id},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){return responseError(e)}
}
