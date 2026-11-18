import type { PoolClient } from "pg";
import { ApiError } from "./db";

type Filter={op:"eq"|"is"|"in";field:string;value:unknown};
export type QueryInput={
 table:string;operation:"select"|"insert"|"update"|"delete";
 fields?:string;filters?:Filter[];data?:Record<string,unknown>|Record<string,unknown>[];
 order?:{field:string;ascending:boolean};limit?:number;single?:boolean;
 count?:boolean;head?:boolean;
};
const tables=new Set([
 "profiles","platform_admins","businesses","business_members","business_invitations",
 "loyalty_programs","loyalty_memberships","loyalty_transactions","business_locations",
 "marketing_consents","marketing_campaigns","platform_billing_settings",
 "business_billing","billing_webhook_events","business_leads"
]);
const editable=new Set(["profiles","businesses","loyalty_programs","business_locations","marketing_campaigns","business_leads"]);
function ident(value:string) {
 if(!/^[a-z_][a-z0-9_]*$/.test(value))throw new ApiError("Campo o tabla no válida.");
 return '"'+value+'"';
}
function splitFields(input:string) {
 const result:string[]=[];let part="",depth=0;
 for(const c of input) {
  if(c==="(")depth++;
  if(c===")")depth--;
  if(depth<0)throw new ApiError("Selección no válida.");
  if(c===","&&depth===0){result.push(part.trim());part="";continue}
  part+=c;
 }
 if(depth!==0)throw new ApiError("Selección no válida.");
 if(part.trim())result.push(part.trim());
 return result;
}
function selection(input:string) {
 const parts=splitFields(input||"*");
 if(parts.length>60)throw new ApiError("Demasiados campos.");
 return parts.map(part=>{
  const rel=part.match(/^businesses\((.*)\)$/);
  if(rel){
   const cols=splitFields(rel[1]).map(c=>c==="*"?"b.*":"b."+ident(c)).join(",");
   if(!cols)throw new ApiError("Relación vacía.");
   return '(SELECT row_to_json(r) FROM (SELECT '+cols+' FROM public.businesses b WHERE b.id=t.business_id LIMIT 1) r) AS "businesses"';
  }
  return part==="*"?"t.*":"t."+ident(part);
 }).join(",");
}
function buildFilters(filters:Filter[],params:unknown[]) {
 if(filters.length>20)throw new ApiError("Demasiados filtros.");
 return filters.map(f=>{
  const col="t."+ident(f.field);
  if(f.op==="is"){
   if(f.value!==null)throw new ApiError("El filtro IS solo admite null.");
   return col+" IS NULL";
  }
  if(f.op==="eq") {
   if(f.value===null)return col+" IS NULL";
   params.push(f.value);
   return col+" = $"+params.length;
  }
  if(f.op==="in"){
   if(!Array.isArray(f.value)||f.value.length>500)throw new ApiError("Filtro IN inválido.");
   if(!f.value.length)return "FALSE";
   const ps=f.value.map(v=>{params.push(v);return "$"+params.length});
   return col+" IN ("+ps.join(",")+")";
  }
  throw new ApiError("Filtro no permitido.");
 }).join(" AND ");
}
function validateData(data:unknown) {
 if(!data||Array.isArray(data)||typeof data!=="object")throw new ApiError("Datos no válidos.");
 const obj=data as Record<string,unknown>;
 if(Object.keys(obj).length<1||Object.keys(obj).length>35)throw new ApiError("Datos no válidos.");
 const keys=Object.keys(obj);
 keys.forEach(ident);
 return {keys,values:keys.map(k=>obj[k])};
}
export async function queryData(client:PoolClient,input:QueryInput) {
 if(!tables.has(input.table))throw new ApiError("Tabla no permitida.",403);
 const table="public."+ident(input.table),op=input.operation;
 const filters=Array.isArray(input.filters)?input.filters:[];
 const params:unknown[]=[];
 const condition=buildFilters(filters,params);
 const where=condition?" WHERE "+condition:"";
 if(op==="select"){
  const limit=Math.min(500,Math.max(1,Math.floor(Number(input.limit)||250)));
  const order=input.order?" ORDER BY t."+ident(input.order.field)+(input.order.ascending?" ASC":" DESC"):"";
  if(input.head||input.count){
   const count=await client.query("SELECT count(*)::int AS total FROM "+table+" t"+where,params);
   if(input.head)return {data:null,count:count.rows[0].total,error:null};
  }
  const columns=selection(input.fields||"*");
  const result=await client.query("SELECT "+columns+" FROM "+table+" t"+where+order+" LIMIT "+limit,params);
  if(input.single){
   if((result.rowCount||0)>1)throw new ApiError("Se encontraron varios registros.",406);
   return {data:result.rows[0]||null,error:null};
  }
  return {data:result.rows,error:null};
 }
 if(!editable.has(input.table))throw new ApiError("Escritura directa no permitida.",403);
 if(op==="insert"){
  if(Array.isArray(input.data))throw new ApiError("La inserción por lotes no está permitida.");
  const {keys,values}=validateData(input.data);
  const sql="INSERT INTO "+table+" ("+keys.map(ident).join(",")+") VALUES ("+
   values.map((_,i)=>"$"+(i+1)).join(",")+")";
  await client.query(sql,values);
  return {data:null,error:null};
 }
 if(op==="update"){
  if(!condition)throw new ApiError("Actualización sin filtro no permitida.");
  const {keys,values}=validateData(input.data);
  const assigns=keys.map((key,i)=>ident(key)+"=$"+(params.length+i+1)).join(",");
  await client.query("UPDATE "+table+" t SET "+assigns+where,[...params,...values]);
  return {data:null,error:null};
 }
 if(op==="delete"){
  if(!condition)throw new ApiError("Eliminación sin filtro no permitida.");
  await client.query("DELETE FROM "+table+" t"+where,params);
  return {data:null,error:null};
 }
 throw new ApiError("Operación no permitida.");
}

type Arg=[string,"uuid"|"text"|"integer"|"boolean"|"bigint"];
type Spec={args:Arg[];returns:"scalar"|"table"};
const rpcMap:Record<string,Spec>={
 admin_create_business:{args:[["p_name","text"],["p_slug","text"],["p_manager_email","text"]],returns:"scalar"},
 invite_staff:{args:[["p_business","uuid"],["p_email","text"],["p_role","text"]],returns:"scalar"},
 claim_invitations:{args:[],returns:"scalar"},
 set_staff_active:{args:[["p_business","uuid"],["p_user","uuid"],["p_active","boolean"]],returns:"scalar"},
 join_program:{args:[["p_business","uuid"]],returns:"scalar"},
 staff_lookup_card:{args:[["p_token","uuid"]],returns:"table"},
 staff_award_card:{args:[["p_token","uuid"],["p_purchase_cents","integer"],["p_stamps","integer"],["p_ticket_ref","text"]],returns:"scalar"},
 staff_redeem_card:{args:[["p_token","uuid"],["p_cashback_cents","integer"]],returns:"scalar"},
 platform_upsert_consent:{args:[["p_opted_in","boolean"]],returns:"scalar"},
 business_upsert_consent:{args:[["p_business","uuid"],["p_opted_in","boolean"]],returns:"scalar"},
 business_customer_directory:{args:[["p_business","uuid"]],returns:"table"},
 business_mail_quote:{args:[["p_business","uuid"]],returns:"table"},
 business_staff_directory:{args:[["p_business","uuid"]],returns:"table"},
 admin_user_directory:{args:[],returns:"table"},
 find_join_business:{args:[["p_slug","text"]],returns:"table"},
 manager_reverse_transaction:{args:[["p_transaction","uuid"],["p_reason","text"]],returns:"scalar"},
 business_employee_activity:{args:[["p_business","uuid"],["p_days","integer"]],returns:"table"},
 admin_convert_lead:{args:[["p_lead","uuid"],["p_slug","text"]],returns:"scalar"}
};
export async function callRpc(client:PoolClient,name:string,args:Record<string,unknown>) {
 const spec=rpcMap[name];
 if(!spec)throw new ApiError("Operación no permitida.",403);
 if(!args||typeof args!=="object"||Object.keys(args).some(k=>!spec.args.some(([n])=>n===k)))throw new ApiError("Parámetros inválidos.");
 const params=spec.args.map(([key])=>Object.prototype.hasOwnProperty.call(args,key)?args[key]:null);
 const sqlargs=spec.args.map(([,type],i)=>"$"+(i+1)+"::"+type).join(",");
 const fn="public."+ident(name)+"("+sqlargs+")";
 const sql=spec.returns==="table"?"SELECT * FROM "+fn:"SELECT "+fn+" AS value";
 const r=await client.query(sql,params);
 return {data:spec.returns==="table"?r.rows:(r.rows[0]?.value??null),error:null};
}