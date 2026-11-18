"use client";

// Ruta histórica de importación; NO utiliza SDK, Auth ni Storage de Supabase.
// Todas las operaciones pasan por el backend local, que aplica RLS en PostgreSQL.
export type User={id:string;email?:string;user_metadata?:{full_name?:string}};
type Result<T=any>={data:T;error:Error|null;count?:number};
type Filter={op:"eq"|"is"|"in";field:string;value:unknown};
function err(message:string):Error{return new Error(message)}
async function post<T=any>(endpoint:string,payload:object):Promise<Result<T>>{
 try{
  const response=await fetch(endpoint,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});
  const body=await response.json() as {data?:T;error?:string;count?:number};
  if(!response.ok||body.error)return {data:(null as T),error:err(body.error||"Error de comunicación."),count:body.count};
  return {data:(body.data as T),error:null,count:body.count};
 }catch{return {data:(null as T),error:err("No se pudo conectar con el servidor.")}}
}
class Query implements PromiseLike<Result>{
 private state:{
  table:string;operation:"select"|"insert"|"update"|"delete";fields:string;filters:Filter[];
  data?:Record<string,unknown>|Record<string,unknown>[];order?:{field:string;ascending:boolean};
  limit?:number;single?:boolean;count?:boolean;head?:boolean
 };
 constructor(table:string){this.state={table,operation:"select",fields:"*",filters:[]}}
 select(fields="*",options?:{count?:"exact";head?:boolean}){
  this.state.fields=fields;this.state.count=options?.count==="exact";this.state.head=options?.head;return this;
 }
 eq(field:string,value:unknown){this.state.filters.push({op:"eq",field,value});return this}
 is(field:string,value:null){this.state.filters.push({op:"is",field,value});return this}
 in(field:string,value:unknown[]){this.state.filters.push({op:"in",field,value});return this}
 order(field:string,options?:{ascending?:boolean}){this.state.order={field,ascending:options?.ascending!==false};return this}
 limit(n:number){this.state.limit=n;return this}
 maybeSingle(){this.state.single=true;return this}
 single(){this.state.single=true;return this}
 insert(data:Record<string,unknown>|Record<string,unknown>[]){this.state.operation="insert";this.state.data=data;return this}
 update(data:Record<string,unknown>){this.state.operation="update";this.state.data=data;return this}
 delete(){this.state.operation="delete";return this}
 then<TResult1=Result,TResult2=never>(
  onfulfilled?:((value:Result)=>TResult1|PromiseLike<TResult1>)|null,
  onrejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null
 ):Promise<TResult1|TResult2>{
  return post("/api/local/query",this.state).then(onfulfilled,onrejected);
 }
}
const auth={
 getUser:async()=>post<{user:User|null}>("/api/local/auth",{action:"getUser"}),
 getSession:async()=>post<{session:{access_token:string;user:User}|null}>("/api/local/auth",{action:"getSession"}),
 signOut:async()=>post("/api/local/auth",{action:"signOut"}),
 signInWithPassword:async(data:{email:string;password:string})=>post("/api/local/auth",{action:"signInWithPassword",...data}),
 signUp:async(data:{email:string;password:string;options?:{data?:{full_name?:string}}})=>post<{user:User|null;session:unknown}>("/api/local/auth",{action:"signUp",email:data.email,password:data.password,full_name:data.options?.data?.full_name}),
 resetPasswordForEmail:async(email:string,_options?:{redirectTo?:string})=>post("/api/local/auth",{action:"resetPasswordForEmail",email}),
 updateUser:async(data:{email?:string;password?:string})=>post("/api/local/auth",{action:"updateUser",...data}),
 exchangeCodeForSession:async(_code:string)=>({data:null,error:err("El enlace de acceso ya no utiliza códigos externos.")}),
 signInWithOAuth:async(_options:unknown)=>({data:null,error:err("El acceso con Google/Apple aún no está configurado.")})
};
const storage={
 from(bucket:string){return {
  async upload(path:string,file:File,_options?:{contentType?:string;upsert?:boolean}):Promise<Result>{
   const form=new FormData();form.set("bucket",bucket);form.set("path",path);form.set("file",file);
   try{
    const r=await fetch("/api/local/assets",{method:"POST",credentials:"same-origin",body:form});
    const result=await r.json() as {error?:string;path?:string};
    return {data:r.ok?{path:result.path}:null,error:r.ok?null:err(result.error||"Error al subir la imagen.")};
   }catch{return {data:null,error:err("No se pudo subir la imagen.")}}
  },
  getPublicUrl(path:string){return {data:{publicUrl:(typeof window!=="undefined"?window.location.origin:"")+"/api/assets/"+encodeURIComponent(bucket)+"/"+path.split("/").map(encodeURIComponent).join("/")}}}
 }}
};
const localDb={auth,storage,from:(table:string)=>new Query(table),rpc:(name:string,args:Record<string,unknown>={})=>post("/api/local/rpc",{name,args})};
export function configured(){return true}
export function db(){return localDb}
