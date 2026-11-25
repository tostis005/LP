import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID,randomBytes} from "node:crypto";
import pg from "pg";
const require=createRequire(import.meta.url);
assert.equal(process.env.POSTGRES_DB,"lp_test","Use only isolated CI PostgreSQL");
process.env.PGDATABASE=process.env.POSTGRES_DB;
process.env.PGUSER="lp_api";
process.env.PGPASSWORD=process.env.APP_DB_PASSWORD;
process.env.AUTH_PGUSER="lp_auth";
process.env.AUTH_PGPASSWORD=process.env.AUTH_DB_PASSWORD;
const oauth=require("../../.crm-connector-test/crm-oauth.js");
const research=require("../../.crm-connector-test/crm-research.js");
const {apiPool,authPool,ApiError,hashToken}=require("../../.crm-connector-test/db.js");
const root=new pg.Pool({host:process.env.PGHOST,port:Number(process.env.PGPORT||5432),database:"lp_test",user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
const ids=[],sourceIds=[];
const tag=randomUUID().slice(0,8);
let blockedEmail;
try{
 const makeUser=async(admin)=>{
  const email=(admin?"crm-admin-":"crm-user-")+tag+"@example.com";
  const id=(await root.query("INSERT INTO auth.users(email,password_hash,email_confirmed_at) VALUES($1,'test-only',now()) RETURNING id",[email])).rows[0].id;
  ids.push(id);if(admin)await root.query("INSERT INTO public.platform_admins(user_id) VALUES($1)",[id]);
  return {id,email,user_metadata:{}};
 };
 const admin=await makeUser(true),other=await makeUser(false);
 const verifier=randomBytes(32).toString("base64url");
 const requestParams=new URLSearchParams({client_id:oauth.crmOAuth.clientId,redirect_uri:oauth.crmOAuth.redirectUri,resource:oauth.crmOAuth.resource,scope:oauth.crmOAuth.scope,response_type:"code",state:"test",code_challenge:oauth.pkce(verifier),code_challenge_method:"S256"});
 const params=oauth.validateAuthorization(requestParams);
 for(const [key,value] of [["redirect_uri","https://example.com"],["resource","https://example.com"],["scope","admin"],["code_challenge_method","plain"],["client_id","other"]]){
  const changed=new URLSearchParams(requestParams);changed.set(key,value);assert.throws(()=>oauth.validateAuthorization(changed));
 }
 const duplicate=new URLSearchParams(requestParams);duplicate.append("state","duplicate");assert.throws(()=>oauth.validateAuthorization(duplicate));
 await assert.rejects(()=>oauth.issueCrmCode(other,params),e=>e.status===403);
 const code=await oauth.issueCrmCode(admin,params);
 const exchange=(v=verifier)=>new URLSearchParams({grant_type:"authorization_code",client_id:oauth.crmOAuth.clientId,redirect_uri:oauth.crmOAuth.redirectUri,resource:oauth.crmOAuth.resource,code,code_verifier:v});
 await assert.rejects(()=>oauth.exchangeCrmCode(exchange(randomBytes(32).toString("base64url"))),/invalid_grant/);
 const grant=await oauth.exchangeCrmCode(exchange());
 await assert.rejects(()=>oauth.exchangeCrmCode(exchange()),/invalid_grant/);
 const stored=(await root.query("SELECT code_hash,token_hash FROM auth.crm_research_grants WHERE user_id=$1",[admin.id])).rows[0];
 assert.equal(stored.code_hash,hashToken(code));assert.equal(stored.token_hash,hashToken(grant.access_token));
 assert.notEqual(stored.token_hash,grant.access_token);
 const request=new Request(oauth.crmOAuth.resource,{headers:{Authorization:"Bearer "+grant.access_token}});
 await assert.rejects(()=>oauth.withCrmBearer(new Request(oauth.crmOAuth.resource),async()=>true),e=>e.status===401);
 async function makeBusiness(municipality="003",status="pending_review",email=null){
  const source_id=String(BigInt("0x"+randomBytes(6).toString("hex")));
  sourceIds.push(source_id);
  await root.query("INSERT INTO public.crm_prospects(source_id,name,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,status) VALUES($1,'Prueba CRM','02','Baja California',$2,'Prueba','0001','Tecate','722515','Cafetería','Restaurantes y cafeterías',$3,$4)",[source_id,municipality,email,status]);
  return source_id;
 }
 const valid=await makeBusiness(),outside=await makeBusiness("004"),excluded=await makeBusiness("003","do_not_contact"),existing=await makeBusiness("003","pending_review","contact@example.org"),blocked=await makeBusiness();
 blockedEmail="blocked-"+tag+"@example.com";await root.query("INSERT INTO public.crm_email_exclusions(email) VALUES($1)",[blockedEmail]);
 const evidence=(id,email)=>({source_id:id,review:"source_found",source_url:"https://example.com/contact",public_email:email});
 assert.throws(()=>research.parseEvidence([evidence(valid,"bad")]));
 assert.throws(()=>research.parseEvidence([evidence(valid,"info@example.org"),evidence(valid,"info@example.org")]));
 const queue=await oauth.withCrmBearer(request,c=>research.researchQueue(c,""));
 assert.ok(queue.rows.some(r=>r.source_id===valid));
 assert.ok(!queue.rows.some(r=>[outside,excluded,existing].includes(r.source_id)));
 const records=research.parseEvidence([evidence(valid,"info@example.org"),evidence(outside,"info@example.org"),evidence(excluded,"info@example.org"),evidence(existing,"info@example.org"),evidence(blocked,blockedEmail)]);
 const results=await oauth.withCrmBearer(request,c=>research.recordResearch(c,records));
 assert.deepEqual(results.map(x=>x.result),["recorded","not_found","excluded","existing_contact","excluded"]);
 const row=(await root.query("SELECT email,public_email,contact_review FROM public.crm_prospects WHERE source_id=$1",[valid])).rows[0];
 assert.deepEqual(row,{email:null,public_email:"info@example.org",contact_review:"source_found"});
 const after=await oauth.withCrmBearer(request,c=>research.researchQueue(c,""));
 assert.ok(!after.rows.some(r=>r.source_id===valid));
 await root.query("DELETE FROM public.platform_admins WHERE user_id=$1",[admin.id]);
 await assert.rejects(()=>oauth.withCrmBearer(request,async()=>true),e=>e.status===403);
 await root.query("INSERT INTO public.platform_admins(user_id) VALUES($1)",[admin.id]);
 assert.ok(await oauth.revokeCrmGrants(admin)>=1);
 await assert.rejects(()=>oauth.withCrmBearer(request,async()=>true),e=>e.status===401);
 const second=await oauth.issueCrmCode(admin,params);
 const secondGrant=await oauth.exchangeCrmCode(new URLSearchParams({...Object.fromEntries(exchange()),code:second}));
 await root.query("UPDATE auth.crm_research_grants SET token_expires_at=now()-interval '1 second' WHERE token_hash=$1",[hashToken(secondGrant.access_token)]);
 await assert.rejects(()=>oauth.withCrmBearer(new Request(oauth.crmOAuth.resource,{headers:{Authorization:"Bearer "+secondGrant.access_token}}),async()=>true),e=>e.status===401);
 console.log("CRM OAuth: PKCE, one-time exchange, hash storage, role changes, expiry, revocation, scope, exclusions and contact preservation verified.");
}finally{
 if(sourceIds.length)await root.query("DELETE FROM public.crm_prospects WHERE source_id=ANY($1::text[])",[sourceIds]);
 if(blockedEmail)await root.query("DELETE FROM public.crm_email_exclusions WHERE email=$1",[blockedEmail]);
 if(ids.length){await root.query("DELETE FROM public.platform_admins WHERE user_id=ANY($1::uuid[])",[ids]);await root.query("DELETE FROM auth.users WHERE id=ANY($1::uuid[])",[ids]);}
 await Promise.all([root.end(),apiPool.end(),authPool.end()]);
}
