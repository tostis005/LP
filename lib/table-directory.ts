export type TableValue=string|number|null|undefined;
export type TableColumn<T,K extends string>={key:K;label:string;value:(row:T)=>TableValue;search?:(row:T)=>TableValue;matches?:(row:T,filter:string)=>boolean;options?:readonly (readonly [string,string])[];filter?:"text"|"select"|"date"|"number"};
export type TableOrder<K extends string>={key:K;direction:"asc"|"desc"};
export function normalized(value:TableValue){return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("es");}
export function selectDirectoryRows<T,K extends string>(rows:readonly T[],columns:readonly TableColumn<T,K>[],filters:Partial<Record<K,string>>,order:TableOrder<K>){
 const matches=rows.filter(row=>columns.every(c=>{
  const filter=filters[c.key];if(!filter)return true;if(c.matches)return c.matches(row,filter);
  const value=(c.search||c.value)(row);
  return c.filter==="select"||c.filter==="number"||c.filter==="date"?normalized(value)===normalized(filter):normalized(value).includes(normalized(filter));
 }));
 const column=columns.find(c=>c.key===order.key);if(!column)return matches;
 return matches.sort((a,b)=>{
  const av=column.value(a),bv=column.value(b);
  if(av==null||av==="")return bv==null||bv===""?0:1;
  if(bv==null||bv==="")return -1;
  const cmp=typeof av==="number"&&typeof bv==="number"?av-bv:String(av).localeCompare(String(bv),"es",{sensitivity:"base",numeric:true});
  return order.direction==="asc"?cmp:-cmp;
 });
}
