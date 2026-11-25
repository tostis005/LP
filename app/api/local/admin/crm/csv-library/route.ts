import {actorFromRequest,asActor,checkOrigin,ApiError,responseError} from "@/lib/server/db";
import {listCityCsvs,readCityCsv} from "@/lib/server/crm-csv-library";
import {parseContactCsv,contactBatch} from "@/lib/server/crm-contact-batch";
import type {PoolClient} from "pg";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
async function admin<T>(request:Request,fn:(c:PoolClient)=>Promise<T>){
 const actor=await actorFromRequest(request);
 if(!actor)throw new ApiError("Inicia sesión.",401);
 return asActor(actor,async c=>{
  if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("Solo administración.",403);
  return fn(c);
 });
}
export async function GET(request:Request){
 try{
  return Response.json(await admin(request,async c=>{
   const files=await listCityCsvs();
   const history=(await c.query("SELECT filename,created_at,report FROM public.crm_import_runs WHERE source='WEB' AND report ? 'sha256' ORDER BY created_at DESC")).rows;
   return {files:files.map(f=>{
    const latest=history.find(h=>h.filename===f.filename);
    const exact=history.find(h=>h.filename===f.filename&&h.report.sha256===f.sha256);
    return {...f,status:exact?"imported":latest?"updated":"pending",lastImport:exact||latest||null};
   })};
  }),{headers});
 }catch(e){return responseError(e);}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  return await admin(request,async c=>{
   const raw=await request.text();if(raw.length>8192)throw new ApiError("Solicitud demasiado larga.",413);
   const v=JSON.parse(raw);
   if(!v||typeof v.filename!=="string"||typeof v.sha256!=="string"||!/^[a-f0-9]{64}$/.test(v.sha256)||!["preview","apply"].includes(v.mode))throw new ApiError("Solicitud inválida.");
   if(v.mode==="apply"&&(v.confirm!==true||typeof v.plan!=="string"||!/^[a-f0-9]{64}$/.test(v.plan)))throw new ApiError("Confirma la vista previa de esta versión.");
   const file=await readCityCsv(v.filename);
   if(file.sha256!==v.sha256)throw new ApiError("El archivo ha cambiado. Actualiza la biblioteca.",409);
   const candidates=parseContactCsv(new TextDecoder("utf-8",{fatal:true}).decode(file.data));
   const data=await contactBatch(c,candidates,v.mode==="apply"?"all":undefined,{filename:file.filename,sha256:file.sha256,plan:v.mode==="apply"?v.plan:undefined});
   const counts={update:0,create:0,skip:0},reasons:Record<string,number>={};
   for(const d of data.decisions){counts[d.action]++;if(d.action==="skip")reasons[d.reason]=(reasons[d.reason]||0)+1;}
   return Response.json({...data,decisions:data.decisions.slice(0,50),total:data.decisions.length,counts,reasons},{headers});
  });
 }catch(e){return responseError(e);}
}
