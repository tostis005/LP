import {actorFromRequest,ApiError} from "@/lib/server/db";
import {rateLimit} from "@/lib/server/auth";
import {crmOAuth,validateAuthorization,requireCrmAdmin,issueCrmCode} from "@/lib/server/crm-oauth";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store","Content-Type":"text/html; charset=utf-8","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const escape=(s:string)=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
function page(body:string,status=200){
 return new Response('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autorizar CRM KREYVI</title><style>body{font-family:system-ui,sans-serif;max-width:540px;margin:48px auto;padding:0 20px;color:#30252a}h1{font-size:26px}button{padding:12px 18px;border-radius:8px;border:1px solid #6b2237;margin:5px;background:white;color:#6b2237}button[value=allow]{background:#6b2237;color:white}p{line-height:1.6}</style></head><body>'+body+'</body></html>',{status,headers});
}
function errorPage(e:unknown){return page("<h1>No se pudo autorizar</h1><p>"+escape(e instanceof ApiError?e.message:"Error en la autorización.")+"</p>",e instanceof ApiError?e.status:500);}
export async function GET(request:Request){
 try{
  const params=validateAuthorization(new URL(request.url).searchParams);
  const actor=await actorFromRequest(request);
  if(!actor)return page('<h1>Conecta tu CRM de KREYVI</h1><p>Abre KREYVI en otra pestaña e inicia sesión como administrador. Después vuelve a esta pantalla y recárgala.</p><p><a href="https://kreyvi.com/acceder" target="_blank" rel="noopener noreferrer">Acceder a KREYVI</a></p>',401);
  await requireCrmAdmin(actor);
  const hidden=Object.entries(params).map(([key,value])=>'<input type="hidden" name="'+key+'" value="'+escape(value)+'">').join("");
  return page('<h1>Autorizar ChatGPT para KREYVI</h1><p>Conectas tu cuenta de administrador a la investigación comercial de Tecate.</p><ul><li>Consultar hasta 25 establecimientos pendientes y las estadísticas.</li><li>Registrar datos comerciales publicados y su fuente.</li><li>Sin envío de correos, acceso a clientes ni facturación.</li></ul><p>El acceso caduca en una hora y puedes revocarlo desde el CRM.</p><form method="post" action="/api/crm-connect/authorize">'+hidden+'<button name="decision" value="deny">Cancelar</button><button name="decision" value="allow">Autorizar</button></form>');
 }catch(e){return errorPage(e);}
}
export async function POST(request:Request){
 try{
  // Explicit same-origin consent; never accept a cross-origin browser submission.
  if(request.headers.get("origin")!==crmOAuth.issuer)throw new ApiError("Origen no autorizado.",403);
  const actor=await requireCrmAdmin(await actorFromRequest(request));
  await rateLimit("crm-consent:"+actor.id,10,5);
  if(Number(request.headers.get("content-length")||0)>12000)throw new ApiError("Solicitud demasiado grande.",413);
  const raw=await request.text();if(raw.length>12000)throw new ApiError("Solicitud demasiado grande.",413);
  const form=new URLSearchParams(raw),params=validateAuthorization(form);
  if(form.getAll("decision").length!==1||!["allow","deny"].includes(form.get("decision")||""))throw new ApiError("Confirma tu decisión.");
  const target=new URL(params.redirect_uri);
  target.searchParams.set("state",params.state);
  target.searchParams.set("iss",crmOAuth.issuer);
  if(form.get("decision")==="deny")target.searchParams.set("error","access_denied");
  else target.searchParams.set("code",await issueCrmCode(actor,params));
  return new Response(null,{status:303,headers:{Location:target.href,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 }catch(e){return errorPage(e);}
}
