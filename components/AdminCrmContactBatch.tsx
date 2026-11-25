"use client";
import {useState} from "react";
type Decision={row:number;name:string;city:string;email:string;source:string;address:string;action:"update"|"create"|"skip";id:string;reason:string};
export function AdminCrmContactBatch({onSaved}:{onSaved:()=>void}){
 const [csv,setCsv]=useState(""),[decisions,setDecisions]=useState<Decision[]>([]),[selected,setSelected]=useState<number[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function load(file:File|undefined){setCsv("");setDecisions([]);setSelected([]);setError("");setNotice("");if(!file)return;if(file.size>1024*1024){setError("El archivo supera 1 MB.");return;}try{setCsv(await file.text());}catch{setError("No se pudo leer el archivo.");}}
 async function run(mode:"preview"|"apply"){
  setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/local/admin/crm/contact-batch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({csv,mode,selected:decisions.filter(d=>selected.includes(d.row)).map(({row,action,id})=>({row,action,id}))})});
   const j=await r.json();if(!r.ok)throw Error(j.error||"Error de importación.");
   if(mode==="preview"){setDecisions(j.decisions);setSelected(j.decisions.filter((d:Decision)=>d.action==="update").map((d:Decision)=>d.row));}
   else{setNotice(j.updated+" fichas actualizadas, "+j.created+" creadas y "+j.skipped+" omitidas. No se ha enviado ningún correo.");setDecisions([]);setSelected([]);setCsv("");onSaved();}
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <details><summary><strong>Importar contactos investigados (CSV)</strong></summary>
  <p>Analiza hasta 250 registros de Tecate. Conserva correos existentes, exclusiones y estados comerciales. Las altas nuevas requieren dirección publicada y selección explícita.</p>
  <p className="muted">Columnas: negocio, sector, estado, municipio, localidad, correo_publicado, url_fuente; opcionales: id_denue, direccion.</p>
  <div className="form-stack"><label>Archivo de contactos<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>void load(e.target.files?.[0])}/></label>
  <button className="button button-outline button-sm" disabled={busy||!csv} onClick={()=>void run("preview")}>Analizar coincidencias</button></div>
  {decisions.length>0&&<><p>{decisions.filter(d=>d.action==="update").length} actualizaciones posibles · {decisions.filter(d=>d.action==="create").length} altas posibles · {decisions.filter(d=>d.action==="skip").length} omitidas.</p>
  <div className="table-wrap"><table className="data-table"><thead><tr><th>Incluir</th><th>Negocio</th><th>Correo / fuente</th><th>Acción</th></tr></thead><tbody>{decisions.map(d=><tr key={d.row}><td><input type="checkbox" aria-label={"Incluir "+d.name} disabled={busy||d.action==="skip"} checked={selected.includes(d.row)} onChange={e=>setSelected(s=>e.target.checked?[...s,d.row]:s.filter(x=>x!==d.row))}/></td><td>{d.name}<small>{d.city}{d.address?" · "+d.address:""}</small></td><td>{d.email}<small><a href={d.source} target="_blank" rel="noreferrer">Fuente pública</a></small></td><td>{d.action==="update"?"Actualizar":d.action==="create"?"Crear":"Omitir"}<small>{d.reason}</small></td></tr>)}</tbody></table></div>
  <button className="button button-dark button-sm" disabled={busy||!selected.length} onClick={()=>void run("apply")}>Confirmar importación de {selected.length} fichas</button></>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </details>;
}
