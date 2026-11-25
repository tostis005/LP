import {crmOAuth,withCrmBearer} from "@/lib/server/crm-oauth";
import {researchQueue,recordResearch,parseEvidence} from "@/lib/server/crm-research";
import {ApiError} from "@/lib/server/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
const supported=["2025-11-25","2025-06-18","2025-03-26"];
const securitySchemes=[{type:"oauth2",scopes:[crmOAuth.scope]}];
const tools=[
 {name:"tecate_pending_businesses",title:"Consultar pendientes de Tecate",description:"Consulta hasta 25 establecimientos de restauración, cafeterías y heladerías pendientes de revisar y las estadísticas reales del piloto. No envía correos.",inputSchema:{type:"object",properties:{after:{type:"string",description:"Cursor devuelto por la consulta anterior."}},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},securitySchemes,_meta:{securitySchemes}},
 {name:"tecate_record_contact_review",title:"Registrar revisión comercial en Tecate",description:"Actualiza hasta 25 establecimientos existentes por ID DENUE. Usa únicamente correos publicados como contacto del negocio, con fuente comprobada. No inventes direcciones ni registres datos personales ajenos al negocio. No envía mensajes, no sustituye evidencia conflictiva ni omite exclusiones.",inputSchema:{type:"object",properties:{reviews:{type:"array",minItems:1,maxItems:25,items:{type:"object",properties:{source_id:{type:"string"},review:{type:"string",enum:["source_found","no_contact_found","ambiguous","not_relevant"]},source_url:{type:"string"},public_email:{type:["string","null"]}},required:["source_id","review","source_url","public_email"],additionalProperties:false}}},required:["reviews"],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},securitySchemes,_meta:{securitySchemes}}
];
function unauthorized(){return Response.json({error:"invalid_token"},{status:401,headers:{...headers,"WWW-Authenticate":'Bearer resource_metadata="'+crmOAuth.metadata+'", scope="'+crmOAuth.scope+'", error="invalid_token"'}});}
function rpc(id:unknown,result:unknown){return Response.json({jsonrpc:"2.0",id,result},{headers});}
function rpcError(id:unknown,code:number,message:string){return Response.json({jsonrpc:"2.0",id:id??null,error:{code,message}},{headers});}
function content(result:Record<string,unknown>){return {content:[{type:"text",text:JSON.stringify(result)}],structuredContent:result};}
export async function POST(request:Request){
 const origin=request.headers.get("origin");
 if(origin&&![crmOAuth.issuer,"https://chatgpt.com"].includes(origin))return new Response(null,{status:403,headers});
 let id:unknown=null;
 try{
  return await withCrmBearer(request,async c=>{
   if(!request.headers.get("content-type")?.startsWith("application/json"))return new Response(null,{status:415,headers});
   if(Number(request.headers.get("content-length")||0)>80000)return new Response(null,{status:413,headers});
   const raw=await request.text();if(raw.length>80000)return new Response(null,{status:413,headers});
   const msg=JSON.parse(raw);
   if(!msg||Array.isArray(msg)||msg.jsonrpc!=="2.0"||typeof msg.method!=="string")return rpcError(null,-32600,"Invalid Request");
   id=msg.id;
   if(id===undefined&&msg.method.startsWith("notifications/"))return new Response(null,{status:202,headers});
   if(typeof id!=="string"&&typeof id!=="number")return rpcError(null,-32600,"Invalid Request");
   const params=msg.params||{};
   switch(msg.method){
    case "initialize":return rpc(id,{protocolVersion:supported.includes(params.protocolVersion)?params.protocolVersion:supported[0],capabilities:{tools:{}},serverInfo:{name:"kreyvi-crm",version:"0.1.0"}});
    case "ping":return rpc(id,{});
    case "tools/list":return rpc(id,{tools});
    case "tools/call":{
     try{
      if(params.name==="tecate_pending_businesses"){
       const after=params.arguments?.after??"";
       if(typeof after!=="string")throw new ApiError("Cursor inválido.");
       return rpc(id,content(await researchQueue(c,after)));
      }
      if(params.name==="tecate_record_contact_review"){
       return rpc(id,content({results:await recordResearch(c,parseEvidence(params.arguments?.reviews))}));
      }
      return rpcError(id,-32602,"Herramienta no disponible.");
     }catch(e){
      // A thrown database error must escape the transaction so it rolls back.
      if(!(e instanceof ApiError))throw e;
      throw e;
     }
    }
    default:return rpcError(id,-32601,"Method not found");
   }
  });
 }catch(e){
  if(e instanceof ApiError&&e.status===401)return unauthorized();
  if(e instanceof ApiError&&e.status===403)return new Response(null,{status:403,headers});
  if(e instanceof ApiError)return rpc(id,{isError:true,content:[{type:"text",text:e.message}]});
  if(e instanceof SyntaxError)return rpcError(null,-32700,"Parse error");
  return rpcError(id,-32603,"No se pudo completar la operación.");
 }
}
export function GET(){return new Response(null,{status:405,headers:{...headers,Allow:"POST"}});}
export function DELETE(){return new Response(null,{status:405,headers:{...headers,Allow:"POST"}});}
