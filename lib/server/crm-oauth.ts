import {createHash,randomBytes} from "node:crypto";
import {actorFromRequest,asActor,authPool,hashToken,ApiError,type Actor} from "./db";
import type {PoolClient} from "pg";

// This connector is deliberately restricted to a single registered public client,
// one callback, one audience and one scope. No dynamic redirect registration.
export const crmOAuth={
 issuer:"https://kreyviapp.com",
 clientId:"kreyvi-crm-chatgpt",
 redirectUri:"https://chatgpt.com/connector_platform_oauth_redirect",
 resource:"https://kreyviapp.com/api/mcp/crm",
 scope:"crm:research",
 authorize:"https://kreyviapp.com/api/crm-connect/authorize",
 token:"https://kreyviapp.com/api/crm-connect/token",
 metadata:"https://kreyviapp.com/.well-known/oauth-protected-resource/api/mcp/crm"
} as const;

export const oauthMetadata={
 issuer:crmOAuth.issuer,authorization_endpoint:crmOAuth.authorize,token_endpoint:crmOAuth.token,
 response_types_supported:["code"],grant_types_supported:["authorization_code"],
 token_endpoint_auth_methods_supported:["none"],code_challenge_methods_supported:["S256"],
 scopes_supported:[crmOAuth.scope],authorization_response_iss_parameter_supported:true
};
export const resourceMetadata={
 resource:crmOAuth.resource,authorization_servers:[crmOAuth.issuer],scopes_supported:[crmOAuth.scope],
 bearer_methods_supported:["header"],resource_name:"KREYVI CRM"
};
export type AuthRequest={client_id:string;redirect_uri:string;resource:string;scope:string;response_type:string;state:string;code_challenge:string;code_challenge_method:string};
export function validateAuthorization(p:URLSearchParams):AuthRequest{
 const fields=["client_id","redirect_uri","resource","scope","response_type","state","code_challenge","code_challenge_method"] as const;
 for(const key of fields)if(p.getAll(key).length!==1)throw new ApiError("Solicitud OAuth incompleta o duplicada.");
 const v=Object.fromEntries(fields.map(key=>[key,p.get(key)!])) as AuthRequest;
 if(v.client_id!==crmOAuth.clientId||v.redirect_uri!==crmOAuth.redirectUri||v.resource!==crmOAuth.resource||v.scope!==crmOAuth.scope||v.response_type!=="code"||v.code_challenge_method!=="S256"||!/^[A-Za-z0-9_-]{43}$/.test(v.code_challenge)||!v.state||v.state.length>1024)throw new ApiError("Cliente, destino o parámetros OAuth no admitidos.");
 return v;
}
export function pkce(verifier:string){return createHash("sha256").update(verifier).digest("base64url");}
export async function requireCrmAdmin(actor:Actor|null){
 if(!actor)throw new ApiError("Inicia sesión en KREYVI.",401);
 await asActor(actor,async c=>{
  if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("Solo administración.",403);
 });
 return actor;
}
export async function browserCrmAdmin(request:Request){return requireCrmAdmin(await actorFromRequest(request));}
export async function issueCrmCode(actor:Actor,p:AuthRequest){
 await requireCrmAdmin(actor);
 const code=randomBytes(32).toString("hex");
 await authPool.query("INSERT INTO auth.crm_research_grants(user_id,client_id,redirect_uri,resource,scope,code_hash,code_challenge,code_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '5 minutes')",[actor.id,p.client_id,p.redirect_uri,p.resource,p.scope,hashToken(code),p.code_challenge]);
 return code;
}
export function validateTokenRequest(p:URLSearchParams){
 for(const key of ["grant_type","client_id","redirect_uri","resource","code","code_verifier"])if(p.getAll(key).length!==1)throw new ApiError("invalid_request");
 const code=p.get("code")!,verifier=p.get("code_verifier")!;
 if(p.get("grant_type")!=="authorization_code"||p.get("client_id")!==crmOAuth.clientId||p.get("redirect_uri")!==crmOAuth.redirectUri||p.get("resource")!==crmOAuth.resource||!/^[a-f0-9]{64}$/.test(code)||!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))throw new ApiError("invalid_grant");
 return {code,verifier};
}
export async function exchangeCrmCode(p:URLSearchParams){
 const {code,verifier}=validateTokenRequest(p);
 const token=randomBytes(32).toString("hex");
 const r=await authPool.query("UPDATE auth.crm_research_grants SET code_used_at=now(),token_hash=$2,token_expires_at=now()+interval '1 hour' WHERE code_hash=$1 AND code_challenge=$3 AND client_id=$4 AND redirect_uri=$5 AND resource=$6 AND scope=$7 AND code_used_at IS NULL AND revoked_at IS NULL AND code_expires_at>now() RETURNING user_id",[hashToken(code),hashToken(token),pkce(verifier),crmOAuth.clientId,crmOAuth.redirectUri,crmOAuth.resource,crmOAuth.scope]);
 if(!r.rowCount)throw new ApiError("invalid_grant");
 return {access_token:token,token_type:"Bearer",expires_in:3600,scope:crmOAuth.scope};
}
export async function withCrmBearer<T>(request:Request,fn:(c:PoolClient)=>Promise<T>){
 const value=request.headers.get("authorization")||"";
 const token=/^Bearer ([a-f0-9]{64})$/i.exec(value)?.[1];
 if(!token)throw new ApiError("invalid_token",401);
 const r=await authPool.query("SELECT u.id,u.email FROM auth.crm_research_grants g JOIN auth.users u ON u.id=g.user_id WHERE g.token_hash=$1 AND g.token_expires_at>now() AND g.revoked_at IS NULL AND g.client_id=$2 AND g.resource=$3 AND g.scope=$4 AND u.email_confirmed_at IS NOT NULL",[hashToken(token),crmOAuth.clientId,crmOAuth.resource,crmOAuth.scope]);
 if(!r.rowCount)throw new ApiError("invalid_token",401);
 const actor:Actor={id:r.rows[0].id,email:r.rows[0].email,user_metadata:{}};
 return asActor(actor,async c=>{
  if(!(await c.query("SELECT public.is_platform_admin() AS allowed")).rows[0]?.allowed)throw new ApiError("insufficient_scope",403);
  return fn(c);
 });
}
export async function revokeCrmGrants(actor:Actor){
 await requireCrmAdmin(actor);
 return (await authPool.query("UPDATE auth.crm_research_grants SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",[actor.id])).rowCount||0;
}
