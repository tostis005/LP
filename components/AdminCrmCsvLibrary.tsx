"use client";
import {useEffect,useState} from "react";
type FileEntry={filename:string;size:number;sha256:string|null;error:string|null;status:"pending"|"updated"|"imported";lastImport:{created_at:string;report:{total:number;updated:number;created:number;skipped:number}}|null};
type Preview={plan:string;total:number;counts:{update:number;create:number;skip:number};reasons:Record<string,number>;decisions:{row:number;name:string;city:string;email:string;source:string;address:string;action:string;reason:string}[]};
const endpoint="/api/local/admin/crm/csv-library";
export function AdminCrmCsvLibrary({onSaved}:{onSaved:()=>void}){
 const [files,setFiles]=useState<FileEntry[]>([]),[focus,setFocus]=useState<FileEntry|null>(null),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loaded,setLoaded]=useState(false);
 async function reload(){
  setError("");setBusy(true);
  try{const r=await fetch(endpoint,{cache:"no-store"}),j=await r.json();if(!r.ok)throw Error(j.error||"No se pudo cargar la biblioteca.");setFiles(j.files);setLoaded(true);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 useEffect(()=>{void reload();},[]);
 async function run(f:FileEntry,mode:"preview"|"apply"){
  setError("");setNotice("");setBusy(true);
  if(mode==="preview"){setFocus(f);setPreview(null);setConfirmed(false);}
  try{
   const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:f.filename,sha256:f.sha256,mode,plan:mode==="apply"?preview?.plan:undefined,confirm:mode==="apply"&&confirmed})});
   const j=await r.json();if(!r.ok)throw Error(j.error||"No se pudo procesar.");
   if(mode==="preview")setPreview(j);
   else{setNotice(j.updated+" actualizados · "+j.created+" nuevos · "+j.skipped+" omitidos. No se enviaron correos.");setFocus(null);setPreview(null);setConfirmed(false);onSaved();await reload();}
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="admin-inspector">
  <div className="content-heading"><div><h3>Biblioteca de CSV por ciudad</h3><p>Archivos disponibles en el servidor. Se importan únicamente cuando un administrador confirma la operación.</p></div><button type="button" className="button button-outline button-sm" onClick={()=>void reload()} disabled={busy}>Actualizar lista</button></div>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {loaded&&!files.length&&<p className="muted">Todavía no hay archivos CSV publicados en crm-imports/.</p>}
  {!!files.length&&<div className="table-wrap"><table className="data-table"><thead><tr><th>Archivo</th><th>Tamaño</th><th>Estado</th><th>Última importación</th><th></th></tr></thead><tbody>
   {files.map(f=><tr key={f.filename}><td>{f.filename}</td><td>{(f.size/1024).toLocaleString("es-MX",{maximumFractionDigits:1})} KB</td><td>{f.error||({pending:"Pendiente",updated:"Nueva versión",imported:"Importado"}[f.status])}</td><td>{f.lastImport?<>{new Date(f.lastImport.created_at).toLocaleString("es-MX")}<small>{f.lastImport.report.created} altas · {f.lastImport.report.updated} actualizaciones · {f.lastImport.report.skipped} omitidos</small></>:"—"}</td><td><button type="button" className="button button-dark button-sm" disabled={busy||!f.sha256||f.status==="imported"} onClick={()=>void run(f,"preview")}>{f.status==="imported"?"Importado":"Importar"}</button></td></tr>)}
  </tbody></table></div>}
  {focus&&preview&&<div className="admin-inspector">
   <h4>Revisar {focus.filename}</h4><p>{preview.total} registros · {preview.counts.update} actualizaciones · {preview.counts.create} altas · {preview.counts.skip} omitidos.</p>
   {Object.entries(preview.reasons).map(([reason,n])=><p className="muted" key={reason}>{n} · {reason}</p>)}
   <details><summary>Vista previa de las primeras {preview.decisions.length} filas de {preview.total}</summary><div className="table-wrap"><table className="data-table"><thead><tr><th>Negocio</th><th>Contacto</th><th>Acción</th></tr></thead><tbody>{preview.decisions.map(d=><tr key={d.row}><td>{d.name}<small>{d.city} {d.address}</small></td><td>{d.email}<small><a href={d.source} target="_blank" rel="noreferrer">Fuente pública</a></small></td><td>{d.action==="create"?"Crear":d.action==="update"?"Actualizar":"Omitir"}<small>{d.reason}</small></td></tr>)}</tbody></table></div></details>
   <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> Confirmo la importación del archivo completo, incluidas las altas nuevas con dirección publicada. He comprobado las fuentes y la identidad de los negocios.</label>
   <div className="content-heading"><button type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>{setFocus(null);setPreview(null);setConfirmed(false);}}>Cancelar</button><button type="button" className="button button-dark button-sm" disabled={busy||!confirmed} onClick={()=>void run(focus,"apply")}>{busy?"Procesando…":"Confirmar importación"}</button></div>
  </div>}
 </section>;
}
