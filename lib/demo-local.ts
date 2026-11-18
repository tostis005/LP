"use client";

// Sesiones de recorrido del producto: los datos se mantienen EN ESTE NAVEGADOR.
// Nunca se emite una sesión del servidor ni se envían estas operaciones a PostgreSQL.
// Los componentes /admin, /negocio, /empleado y /app son los mismos que usan las cuentas reales.
export type DemoRole="administrador"|"gestor"|"empleado"|"cliente";
type Row=Record<string,any>;
type DemoState={tables:Record<string,Row[]>;assets:Record<string,string>};
type DemoResult<T=any>={data:T;error:Error|null;count?:number};
type Filter={op:"eq"|"in"|"is";field:string;value:any};
const ROLE_KEY="loyally_role_session_v2",DATA_KEY="loyally_role_sample_v2";
export const DEMO_BUSINESS_ID="11111111-1111-4111-8111-111111111111";
export const DEMO_CARD_TOKEN="99999999-9999-4999-8999-999999999999";
const IDs={
 administrador:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
 gestor:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
 empleado:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
 cliente:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",
 alvaro:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
 lucia:"ffffffff-ffff-4fff-8fff-ffffffffffff",
 otra:"12121212-1212-4121-8121-121212121212"
};
const businessIds=[DEMO_BUSINESS_ID,"22222222-2222-4222-8222-222222222222","33333333-3333-4333-8333-333333333333"];
const roles:DemoRole[]=["administrador","gestor","empleado","cliente"];
function isBrowser(){return typeof window!=="undefined"}
export function demoRole():DemoRole|null{
 if(!isBrowser())return null;
 try{const role=window.sessionStorage.getItem(ROLE_KEY) as DemoRole|null;return roles.includes(role as DemoRole)?role:null}catch{return null}
}
export function enterDemo(role:DemoRole){
 if(!isBrowser()||!roles.includes(role))return;
 window.sessionStorage.setItem(ROLE_KEY,role);
 if(!window.localStorage.getItem(DATA_KEY))save(seed());
}
export function leaveDemo(){if(isBrowser())window.sessionStorage.removeItem(ROLE_KEY)}
export function resetDemo(){if(isBrowser()){window.localStorage.removeItem(DATA_KEY);save(seed())}}
function now(){return new Date().toISOString()}
function days(n:number){return new Date(Date.now()-n*86400000).toISOString()}
function uuid(){return typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():("xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx").replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==="x"?r:(r&3|8)).toString(16)})}
function seed():DemoState{
 const businesses:Row[]=[
  {id:businessIds[0],name:"Café Noma",slug:"cafe-noma",description:"Café de especialidad y desayunos hechos con cariño.",category:"Cafetería",accent_color:"#264d3e",logo_url:null,card_background:null,card_text:"GRACIAS POR VOLVER",stamp_icon:"coffee",stamp_image_url:null,public_listing:true,active:true,created_at:days(90)},
  {id:businessIds[1],name:"Brunch Club",slug:"brunch-club",description:"Un buen brunch siempre se comparte.",category:"Restaurante",accent_color:"#c57a54",logo_url:null,card_background:null,card_text:"LO MEJOR ES VOLVER",stamp_icon:"burger",stamp_image_url:null,public_listing:true,active:true,created_at:days(75)},
  {id:businessIds[2],name:"Barba Norte",slug:"barba-norte",description:"Tu barbería de confianza.",category:"Barbería",accent_color:"#69568c",logo_url:null,card_background:null,card_text:"TU ESTILO, NUESTRA PASIÓN",stamp_icon:"beard",stamp_image_url:null,public_listing:true,active:true,created_at:days(50)}
 ];
 const programs=businesses.map((b,i)=>({id:uuid(),business_id:b.id,type:"stamps",reward_label:["Un café gratis","Un desayuno gratis","Un arreglo de barba gratis"][i],reward_cost:[8,6,10][i],cashback_bps:500,points_per_euro:1,max_stamps_per_action:3,max_ticket_cents:50000,min_seconds_between_awards:30,max_daily_awards_per_employee:250,require_ticket_reference:false}));
 const people:Row[]=[
  {id:IDs.administrador,full_name:"Alex · Administración",email:"admin@demo.loyally.test",created_at:days(150)},
  {id:IDs.gestor,full_name:"Clara · Café Noma",email:"gestor@demo.loyally.test",created_at:days(90)},
  {id:IDs.empleado,full_name:"Daniel · Atención",email:"personal@demo.loyally.test",created_at:days(65)},
  {id:IDs.cliente,full_name:"Martina López",email:"martina@demo.loyally.test",created_at:days(45)},
  {id:IDs.alvaro,full_name:"Álvaro Ruiz",email:"alvaro@demo.loyally.test",created_at:days(40)},
  {id:IDs.lucia,full_name:"Lucía Torres",email:"lucia@demo.loyally.test",created_at:days(28)},
  {id:IDs.otra,full_name:"Pablo Sánchez",email:"pablo@demo.loyally.test",created_at:days(32)}
 ];
 const members=[
  ...businesses.map(b=>({business_id:b.id,user_id:IDs.administrador,role:"owner",active:true})),
  {business_id:businessIds[0],user_id:IDs.gestor,role:"owner",active:true},
  {business_id:businessIds[0],user_id:IDs.empleado,role:"employee",active:true}
 ];
 const cardDefs=[
  {id:"11111111-aaaa-4aaa-8aaa-111111111111",business_id:businessIds[0],customer_id:IDs.cliente,card_token:DEMO_CARD_TOKEN,balance:4,total_earned:12},
  {id:"11111111-bbbb-4bbb-8bbb-111111111111",business_id:businessIds[1],customer_id:IDs.cliente,card_token:"99999999-9999-4999-8999-999999999998",balance:2,total_earned:2},
  {id:"11111111-cccc-4ccc-8ccc-111111111111",business_id:businessIds[0],customer_id:IDs.alvaro,card_token:"99999999-9999-4999-8999-999999999997",balance:2,total_earned:2},
  {id:"11111111-dddd-4ddd-8ddd-111111111111",business_id:businessIds[0],customer_id:IDs.lucia,card_token:"99999999-9999-4999-8999-999999999996",balance:5,total_earned:5},
  {id:"11111111-eeee-4eee-8eee-111111111111",business_id:businessIds[2],customer_id:IDs.alvaro,card_token:"99999999-9999-4999-8999-999999999995",balance:5,total_earned:5},
  {id:"11111111-ffff-4fff-8fff-111111111111",business_id:businessIds[0],customer_id:IDs.otra,card_token:"99999999-9999-4999-8999-999999999994",balance:1,total_earned:1}
 ].map(x=>({...x,created_at:days(18)}));
 const movements:Row[]=[
  {id:uuid(),business_id:businessIds[0],membership_id:cardDefs[0].id,employee_id:IDs.empleado,kind:"earn",amount_delta:1,purchase_cents:null,ticket_ref:null,reversal_of:null,reversal_reason:null,created_at:days(0)},
  {id:uuid(),business_id:businessIds[0],membership_id:cardDefs[0].id,employee_id:IDs.empleado,kind:"earn",amount_delta:2,purchase_cents:null,ticket_ref:null,reversal_of:null,reversal_reason:null,created_at:days(2)},
  {id:uuid(),business_id:businessIds[0],membership_id:cardDefs[1].id,employee_id:IDs.empleado,kind:"earn",amount_delta:1,purchase_cents:null,ticket_ref:null,reversal_of:null,reversal_reason:null,created_at:days(4)},
  {id:uuid(),business_id:businessIds[0],membership_id:cardDefs[2].id,employee_id:IDs.empleado,kind:"earn",amount_delta:1,purchase_cents:null,ticket_ref:"T-100",reversal_of:null,reversal_reason:null,created_at:days(6)},
  {id:uuid(),business_id:businessIds[2],membership_id:cardDefs[4].id,employee_id:IDs.administrador,kind:"earn",amount_delta:2,purchase_cents:null,ticket_ref:null,reversal_of:null,reversal_reason:null,created_at:days(3)}
 ];
 const locations=[
  {id:uuid(),business_id:businessIds[0],name:"Café Noma · Centro",address:"Av. Álvaro Obregón 42",city:"Ciudad de México",country:"México",lat:19.4167,lng:-99.1620},
  {id:uuid(),business_id:businessIds[1],name:"Brunch Club · Roma",address:"Colima 118",city:"Ciudad de México",country:"México",lat:19.4206,lng:-99.1578},
  {id:uuid(),business_id:businessIds[2],name:"Barba Norte · Condesa",address:"Av. Michoacán 82",city:"Ciudad de México",country:"México",lat:19.4103,lng:-99.1746}
 ];
 return {assets:{},tables:{
  profiles:people,platform_admins:[{user_id:IDs.administrador}],businesses,
  business_members:members,business_invitations:[],loyalty_programs:programs,loyalty_memberships:cardDefs,
  loyalty_transactions:movements,business_locations:locations,marketing_consents:[],marketing_campaigns:[],
  platform_billing_settings:[],business_billing:businessIds.map(id=>({business_id:id,plan:"business",status:"trialing",trial_ends_at:days(-20),stripe_customer_id:null,stripe_subscription_id:null,updated_at:now()})),
  business_leads:[{id:uuid(),business_name:"La Casa del Pan",contact_name:"Rosa Martín",contact_email:"rosa@ejemplo.test",category:"Panadería",city:"Ciudad de México",message:"Me interesan las tarjetas digitales",status:"new",created_at:days(1)}]
 }};
}
function load():DemoState{
 try{
  const raw=window.localStorage.getItem(DATA_KEY);
  if(raw){const value=JSON.parse(raw) as DemoState;if(value&&value.tables&&value.assets)return value}
 }catch{/* Si el navegador borra el almacenamiento, se recrea la muestra. */}
 const value=seed();save(value);return value;
}
function save(data:DemoState){try{window.localStorage.setItem(DATA_KEY,JSON.stringify(data))}catch{/* Modo privado: funcional durante la sesión actual. */}}
function actor(){const r=demoRole();return r?IDs[r]:null}
function demoUser(){const r=demoRole();if(!r)return null;const profile=load().tables.profiles.find(p=>p.id===IDs[r]);return {id:IDs[r],email:profile?.email||"demo@loyally.test",user_metadata:{full_name:profile?.full_name||"Cuenta de prueba"}}}
function ok<T>(data:T,count?:number):DemoResult<T>{return {data,error:null,...(count===undefined?{}:{count})}}
function fail<T=any>(reason:string):DemoResult<T>{return {data:null as T,error:new Error(reason)}}
function equal(a:any,b:any){return a===b||String(a)===String(b)}
function filtered(rows:Row[],filters:Filter[]){return rows.filter(row=>filters.every(f=>{
 if(f.op==="is")return row[f.field]===null||row[f.field]===undefined;
 if(f.op==="in")return Array.isArray(f.value)&&f.value.some(v=>equal(v,row[f.field]));
 return equal(row[f.field],f.value);
}))}
function authorize(table:string,mode:string,rows:Row[]):Row[]{
 const role=demoRole();
 if(role==="administrador")return rows;
 if(["businesses","business_locations","loyalty_programs"].includes(table)&&mode==="select")return rows.filter(r=>r.active!==false);
 if(table==="business_members")return rows.filter(r=>r.user_id===actor());
 if(table==="platform_admins")return [];
 if(table==="loyalty_memberships")return rows.filter(r=>role==="cliente"?r.customer_id===actor():role==="empleado"||role==="gestor"?r.business_id===DEMO_BUSINESS_ID:false);
 if(table==="loyalty_transactions")return rows.filter(r=>role==="gestor"||role==="empleado"?r.business_id===DEMO_BUSINESS_ID:role==="cliente"?load().tables.loyalty_memberships.some(m=>m.customer_id===actor()&&m.id===r.membership_id):false);
 if(table==="profiles")return rows.filter(r=>r.id===actor());
 if(["business_invitations","marketing_campaigns","business_billing"].includes(table))return role==="gestor"?rows.filter(r=>r.business_id===DEMO_BUSINESS_ID):[];
 if(table==="marketing_consents")return rows.filter(r=>r.customer_id===actor());
 if(table==="business_leads")return [];
 return rows;
}
function project(row:Row,fields:string,state:DemoState):Row{
 const match=fields.match(/businesses\(([^)]*)\)/);
 const without=fields.replace(/,?\s*businesses\([^)]*\)/,"").replace(/^,\s*/,"").trim();
 const scalar=without==="*"||without===""?{...row}:Object.fromEntries(without.split(",").map(k=>k.trim()).filter(Boolean).map(k=>[k,row[k]]));
 if(match){
  const biz=state.tables.businesses.find(b=>b.id===row.business_id);
  scalar.businesses=biz?(match[1]==="*"?{...biz}:Object.fromEntries(match[1].split(",").map(k=>k.trim()).map(k=>[k,biz[k]]))):null;
 }
 return scalar;
}
class DemoQuery implements PromiseLike<DemoResult>{
 private table:string;
 private action:"select"|"insert"|"update"|"delete"="select";
 private fields="*";private conditions:Filter[]=[];private orderBy:{key:string;ascending:boolean}|null=null;
 private take=250;private one=false;private count=false;private head=false;private data:Row|Row[]|null=null;
 constructor(table:string){this.table=table}
 select(fields="*",options?:{head?:boolean;count?:"exact"}){this.fields=fields;this.head=!!options?.head;this.count=options?.count==="exact";return this}
 eq(field:string,value:any){this.conditions.push({op:"eq",field,value});return this}
 in(field:string,value:any[]){this.conditions.push({op:"in",field,value});return this}
 is(field:string,value:null){this.conditions.push({op:"is",field,value});return this}
 order(key:string,opts?:{ascending?:boolean}){this.orderBy={key,ascending:opts?.ascending!==false};return this}
 limit(n:number){this.take=n;return this}
 maybeSingle(){this.one=true;return this}
 single(){this.one=true;return this}
 insert(data:Row|Row[]){this.action="insert";this.data=data;return this}
 update(data:Row){this.action="update";this.data=data;return this}
 delete(){this.action="delete";return this}
 async execute():Promise<DemoResult>{
  const state=load(),table=state.tables[this.table];
  if(!table)return fail("Esta función no está disponible en el entorno de prueba.");
  const scope=authorize(this.table,this.action,table);
  const rows=filtered(scope,this.conditions);
  if(this.action==="select"){
   const sorted=[...rows];
   if(this.orderBy){const {key,ascending}=this.orderBy;sorted.sort((a,b)=>{const x=a[key],y=b[key];return (x===y?0:x>y?1:-1)*(ascending?1:-1)})}
   const data=this.head?null:sorted.slice(0,this.take).map(row=>project(row,this.fields,state));
   return {data:this.one?(Array.isArray(data)?data[0]||null:null):data,error:null,...(this.count?{count:rows.length}:{})};
  }
  if(!["administrador","gestor","cliente"].includes(demoRole()||""))return fail("No tienes permiso para modificar este apartado.");
  if(this.action==="update"){
   if(!this.conditions.length)return fail("Selecciona primero el registro.");
   for(const row of rows)Object.assign(row,this.data);
  }else if(this.action==="delete"){
   if(!this.conditions.length)return fail("Selecciona primero el registro.");
   state.tables[this.table]=table.filter(row=>!rows.includes(row));
  }else if(this.action==="insert"){
   const records=Array.isArray(this.data)?this.data:[this.data];
   for(const input of records){if(input){table.push({id:uuid(),created_at:now(),...input})}}
  }
  save(state);return ok(null);
 }
 then<TResult1=DemoResult,TResult2=never>(onfulfilled?:((value:DemoResult)=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):Promise<TResult1|TResult2>{
  return this.execute().then(onfulfilled,onrejected);
 }
}
function userDirectory(state:DemoState){
 return state.tables.profiles.map(p=>({
  user_id:p.id,full_name:p.full_name,email:p.email,
  joined_at:p.created_at,businesses:state.tables.loyalty_memberships.filter(m=>m.customer_id===p.id).length
 }));
}
function memberDirectory(state:DemoState,businessId:string){
 return state.tables.business_members.filter(m=>m.business_id===businessId).map(m=>{
  const user=state.tables.profiles.find(p=>p.id===m.user_id);
  return {user_id:m.user_id,full_name:user?.full_name||"Miembro",email:user?.email||"",role:m.role,active:m.active};
 });
}
function customerDirectory(state:DemoState,businessId:string){
 return state.tables.loyalty_memberships.filter(m=>m.business_id===businessId).map(m=>{
  const user=state.tables.profiles.find(p=>p.id===m.customer_id);
  return {user_id:m.customer_id,full_name:user?.full_name||"",email:user?.email||"",balance:m.balance,total_earned:m.total_earned,joined_at:m.created_at,
   visits:state.tables.loyalty_transactions.filter(t=>t.membership_id===m.id&&t.kind==="earn").length,
   marketing_ok:!!state.tables.marketing_consents.find(c=>c.customer_id===m.customer_id&&c.business_id===businessId&&c.opted_in)};
 });
}
function rpc(name:string,args:Record<string,any>={}):Promise<DemoResult>{
 const role=demoRole(),state=load(),table=state.tables;
 if(!role)return Promise.resolve(fail("Inicia sesión para continuar."));
 let result:DemoResult=ok(null);
 const biz=String(args.p_business||"");
 const manager=role==="gestor"||role==="administrador";
 const canStaff=role==="empleado"||manager;
 const persist=()=>{save(state)};
 const membershipByToken=()=>table.loyalty_memberships.find(m=>m.card_token===String(args.p_token||""));
 try{
  switch(name){
   case "claim_invitations":result=ok(0);break;
   case "admin_user_directory":result=role==="administrador"?ok(userDirectory(state)):fail("Solo disponible para administración.");break;
   case "business_customer_directory":result=manager?ok(customerDirectory(state,biz)):fail("Acceso denegado.");break;
   case "business_staff_directory":result=manager?ok(memberDirectory(state,biz)):fail("Acceso denegado.");break;
   case "business_employee_activity":{
    const tx=table.loyalty_transactions.filter(t=>t.business_id===biz&&t.kind==="earn");
    const memberIds=[...new Set(tx.map(t=>t.employee_id))];
    result=ok(memberIds.map(id=>({user_id:id,employee_name:table.profiles.find(p=>p.id===id)?.full_name||"Personal",operations:tx.filter(t=>t.employee_id===id).length,awarded_units:tx.filter(t=>t.employee_id===id).reduce((sum,t)=>sum+t.amount_delta,0)})));
    break;
   }
   case "find_join_business":{
    const b=table.businesses.find(b=>b.slug===args.p_slug&&b.active);
    const p=b&&table.loyalty_programs.find(p=>p.business_id===b.id);
    result=ok(b&&p?[{business_id:b.id,business_name:b.name,description:b.description,accent_color:b.accent_color,reward_label:p.reward_label,program_type:p.type}]:[]);
    break;
   }
   case "join_program":{
    const exists=table.loyalty_memberships.find(m=>m.business_id===biz&&m.customer_id===actor());
    if(exists){result=ok(exists.id);break}
    const row={id:uuid(),business_id:biz,customer_id:actor(),card_token:uuid(),balance:0,total_earned:0,created_at:now()};
    table.loyalty_memberships.push(row);persist();result=ok(row.id);break;
   }
   case "staff_lookup_card":{
    const m=membershipByToken();
    const p=m&&table.loyalty_programs.find(p=>p.business_id===m.business_id);
    const b=m&&table.businesses.find(b=>b.id===m.business_id);
    const name=m&&table.profiles.find(x=>x.id===m.customer_id)?.full_name;
    result=ok(canStaff&&m&&p&&b?[{membership_id:m.id,business_id:m.business_id,business_name:b.name,customer_name:name||"Cliente",program_type:p.type,balance:m.balance,reward_label:p.reward_label,reward_cost:p.reward_cost}]:[]);
    break;
   }
   case "staff_award_card":
   case "staff_redeem_card":{
    if(!canStaff){result=fail("El perfil seleccionado no puede validar compras.");break}
    const m=membershipByToken();
    const p=m&&table.loyalty_programs.find(p=>p.business_id===m.business_id);
    if(!m||!p){result=fail("Tarjeta no encontrada.");break}
    const delta=name==="staff_award_card"?(p.type==="stamps"?Number(args.p_stamps)||1:Math.floor(Number(args.p_purchase_cents||0)/100*(p.type==="points"?p.points_per_euro:p.cashback_bps/100))):-(p.type==="cashback"?Number(args.p_cashback_cents||0):p.reward_cost);
    if(delta===0||name==="staff_award_card"&&(delta<1||p.type==="stamps"&&delta>p.max_stamps_per_action)){
     result=fail("Cantidad de sellos fuera del límite configurado.");break;
    }
    if(name==="staff_redeem_card"&&m.balance+delta<0){result=fail("Saldo insuficiente para canjear.");break}
    if(args.p_ticket_ref&&table.loyalty_transactions.some(t=>t.business_id===m.business_id&&t.ticket_ref===args.p_ticket_ref)){result=fail("El ticket ya se ha utilizado.");break}
    m.balance+=delta;if(delta>0)m.total_earned+=delta;
    table.loyalty_transactions.unshift({id:uuid(),business_id:m.business_id,membership_id:m.id,employee_id:actor(),kind:delta>0?"earn":"redeem",amount_delta:delta,purchase_cents:args.p_purchase_cents||null,ticket_ref:args.p_ticket_ref||null,reversal_of:null,reversal_reason:null,created_at:now()});
    persist();result=ok(m.balance);break;
   }
   case "manager_reverse_transaction":{
    if(!manager){result=fail("Acceso denegado.");break}
    const original=table.loyalty_transactions.find(t=>t.id===args.p_transaction);
    if(!original){result=fail("No se ha encontrado el movimiento.");break}
    if(table.loyalty_transactions.some(t=>t.reversal_of===original.id)){result=fail("La operación ya fue corregida.");break}
    const m=table.loyalty_memberships.find(m=>m.id===original.membership_id);
    if(!m||m.balance-original.amount_delta<0){result=fail("No se puede corregir: saldo insuficiente.");break}
    m.balance-=original.amount_delta;
    table.loyalty_transactions.unshift({...original,id:uuid(),kind:"reversal",amount_delta:-original.amount_delta,reversal_of:original.id,reversal_reason:args.p_reason,created_at:now()});
    persist();result=ok(null);break;
   }
   case "admin_create_business":{
    if(role!=="administrador"){result=fail("Solo el administrador puede crear negocios.");break}
    const slug=String(args.p_slug||"");
    if(!slug||table.businesses.some(b=>b.slug===slug)){result=fail("El identificador ya existe o es incorrecto.");break}
    const id=uuid();
    table.businesses.unshift({id,name:args.p_name,slug,description:"",category:"Restaurante",accent_color:"#264d3e",logo_url:null,card_background:null,card_text:"GRACIAS POR VOLVER",stamp_icon:"coffee",stamp_image_url:null,public_listing:true,active:true,created_at:now()});
    table.loyalty_programs.push({id:uuid(),business_id:id,type:"stamps",reward_label:"Premio gratis",reward_cost:8,cashback_bps:500,points_per_euro:1,max_stamps_per_action:3,max_ticket_cents:50000,min_seconds_between_awards:30,max_daily_awards_per_employee:250,require_ticket_reference:false});
    table.business_members.push({business_id:id,user_id:IDs.administrador,role:"owner",active:true});
    if(args.p_manager_email)table.business_invitations.push({id:uuid(),email:args.p_manager_email,business_id:id,role:"owner",created_at:now(),claimed_at:null});
    persist();result=ok(id);break;
   }
   case "admin_convert_lead":{
    const lead=table.business_leads.find(l=>l.id===args.p_lead);
    if(!lead){result=fail("Solicitud no encontrada.");break}
    result=awaitRpcCreate(state,lead.business_name,args.p_slug,lead.contact_email);
    lead.status="converted";persist();break;
   }
   case "invite_staff":{
    if(!manager){result=fail("Acceso denegado.");break}
    const inv={id:uuid(),business_id:biz,email:String(args.p_email||""),role:args.p_role||"employee",created_at:now(),claimed_at:null};
    table.business_invitations.push(inv);persist();result=ok(inv.id);break;
   }
   case "set_staff_active":{
    if(!manager){result=fail("Acceso denegado.");break}
    const m=table.business_members.find(x=>x.business_id===biz&&x.user_id===args.p_user);
    if(m){m.active=!!args.p_active;persist()}result=ok(null);break;
   }
   case "platform_upsert_consent":
   case "business_upsert_consent":{
    const businessId=name==="platform_upsert_consent"?null:biz;
    let c=table.marketing_consents.find(c=>c.customer_id===actor()&&c.business_id===businessId);
    if(!c){c={id:uuid(),business_id:businessId,customer_id:actor()};table.marketing_consents.push(c)}
    c.opted_in=!!args.p_opted_in;persist();result=ok(null);break;
   }
   default:result=fail("Esta función todavía no tiene operaciones de prueba.");
  }
 }catch(e){result=fail((e as Error).message)}
 return Promise.resolve(result);
}
function awaitRpcCreate(state:DemoState,name:string,slug:string,email:string):DemoResult{
 const id=uuid();
 state.tables.businesses.push({id,name,slug,description:"",category:"Restaurante",accent_color:"#264d3e",logo_url:null,card_background:null,card_text:"GRACIAS POR VOLVER",stamp_icon:"coffee",stamp_image_url:null,public_listing:true,active:true,created_at:now()});
 state.tables.loyalty_programs.push({id:uuid(),business_id:id,type:"stamps",reward_label:"Premio gratis",reward_cost:8,cashback_bps:500,points_per_euro:1,max_stamps_per_action:3,max_ticket_cents:50000,min_seconds_between_awards:30,max_daily_awards_per_employee:250,require_ticket_reference:false});
 state.tables.business_members.push({business_id:id,user_id:IDs.administrador,role:"owner",active:true});
 state.tables.business_invitations.push({id:uuid(),business_id:id,email,role:"owner",claimed_at:null,created_at:now()});
 return ok(id);
}
const auth={
 getUser:async()=>ok({user:demoUser()}),
 getSession:async()=>ok({session:demoUser()?{access_token:"",user:demoUser()}:null}),
 signOut:async()=>{leaveDemo();return ok(null)},
 signInWithPassword:async()=>fail("Usa el formulario de acceso real para iniciar sesión."),
 signUp:async()=>fail("Usa el formulario de registro real."),
 resetPasswordForEmail:async()=>fail("Recuperación de contraseña no disponible en modo de prueba."),
 updateUser:async(data:{email?:string;password?:string})=>{
  if(!actor())return fail("Inicia sesión.");
  const state=load(),profile=state.tables.profiles.find(p=>p.id===actor());
  if(profile&&data.email){profile.email=data.email;save(state)}
  return ok({user:demoUser()});
 }
};
const storage={
 from(_bucket:string){return {
  async upload(path:string,file:File){
   if(file.size>1024*1024)return fail("En la demostración, utiliza imágenes de hasta 1 MB.");
   if(!["image/png","image/jpeg","image/webp"].includes(file.type))return fail("Formato no válido.");
   const url=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error("No se pudo leer la imagen."));r.readAsDataURL(file)});
   const state=load();state.assets[path]=url;save(state);return ok({path});
  },
  getPublicUrl(path:string){return {data:{publicUrl:load().assets[path]||""}}}
 }}
};
export const demoDb={auth,storage,from:(table:string)=>new DemoQuery(table),rpc};
