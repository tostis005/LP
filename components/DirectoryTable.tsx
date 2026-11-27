"use client";
import {useState} from "react";
import {ArrowDown,ArrowUp,ArrowUpDown,X} from "lucide-react";
import {selectDirectoryRows,type TableColumn,type TableOrder} from "@/lib/table-directory";
export function useDirectoryTable<T,K extends string>(rows:readonly T[],columns:readonly TableColumn<T,K>[],initial:TableOrder<K>){
 const [filters,setFilters]=useState<Partial<Record<K,string>>>({}),[order,setOrder]=useState(initial),[page,setPage]=useState(0);
 const filtered=selectDirectoryRows(rows,columns,filters,order);
 function filter(key:K,value:string){setFilters(old=>({...old,[key]:value}));setPage(0);}
 function sort(key:K){setOrder(old=>({key,direction:old.key===key&&old.direction==="asc"?"desc":"asc"}));setPage(0);}
 function reset(){setFilters({});setPage(0);}
 const size=50,pages=Math.max(1,Math.ceil(filtered.length/size)),current=Math.min(page,pages-1);
 return {filters,order,filter,sort,reset,filtered,visible:filtered.slice(current*size,(current+1)*size),page:current,pages,setPage,total:rows.length};
}
export function DirectoryHead<T,K extends string>({columns,table}:{columns:readonly TableColumn<T,K>[];table:ReturnType<typeof useDirectoryTable<T,K>>}){
 return <thead><tr>{columns.map(c=><th key={c.key} scope="col" aria-sort={table.order.key===c.key?(table.order.direction==="asc"?"ascending":"descending"):"none"}><button type="button" className="directory-sort" onClick={()=>table.sort(c.key)}>{c.label}{table.order.key===c.key?(table.order.direction==="asc"?<ArrowUp size={13}/>:<ArrowDown size={13}/>):<ArrowUpDown size={13}/>}</button></th>)}<th scope="col">Acciones</th></tr>
 <tr className="directory-filter-row">{columns.map(c=><th key={c.key}>{c.filter==="select"?<select aria-label={"Filtrar "+c.label} value={table.filters[c.key]||""} onChange={e=>table.filter(c.key,e.target.value)}><option value="">Todos</option>{c.options?.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:<input aria-label={"Filtrar "+c.label} placeholder={c.filter==="number"?"N.º exacto":c.filter==="date"?undefined:"Buscar…"} type={c.filter==="number"?"number":c.filter==="date"?"date":"search"} min={c.filter==="number"?0:undefined} value={table.filters[c.key]||""} onChange={e=>table.filter(c.key,e.target.value)}/>}</th>)}<th><button className="directory-clear" type="button" onClick={table.reset}><X size={13}/> Limpiar filtros</button></th></tr></thead>;
}
export function DirectoryPager<T,K extends string>({table}:{table:ReturnType<typeof useDirectoryTable<T,K>>}){
 return <div className="directory-pager"><span role="status">{table.filtered.length} de {table.total} resultados{table.pages>1?" · Página "+(table.page+1)+" de "+table.pages:""}</span>{table.pages>1&&<div><button type="button" className="button button-outline button-sm" disabled={table.page===0} onClick={()=>table.setPage(table.page-1)}>Anterior</button><button type="button" className="button button-outline button-sm" disabled={table.page+1>=table.pages} onClick={()=>table.setPage(table.page+1)}>Siguiente</button></div>}</div>;
}
