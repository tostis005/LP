"use client";
import {useState} from "react";
type Locality={locality_code:string;city:string};
export function AdminCrmNewBusiness({localities,onSaved}:{localities:Locality[];onSaved:()=>void}){
 const [name,setName]=useState(""),[locality,setLocality]=useState(""),[category,setCategory]=useState("Restaurantes y cafeterías"),[email,setEmail]=useState(""),[source,setSource]=useState(""),[address,setAddress]=useState(""),[notes,setNotes]=useState(""),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");try{
  const r=await fetch("/api/local/admin/crm/businesses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,locality_code:locality,category,public_email:email,source_url:source,address,notes,confirm_new:confirmed})});
  const j=await r.json();if(!r.ok)throw Error(j.error||"No se pudo guardar.");
  setNotice("Negocio incorporado al CRM.");setName("");setAddress("");setEmail("");setSource("");setNotes("");setConfirmed(false);onSaved();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <details><summary><strong>Alta de negocio localizado en una fuente pública</strong></summary>
  <p>Para establecimientos que no figuran en DENUE. Comprueba primero su identidad y ubicación. No se asignan identificadores INEGI ficticios.</p>
  <form className="form-stack" onSubmit={save}>
   <label>Nombre<input required maxLength={240} value={name} onChange={e=>{setName(e.target.value);setConfirmed(false)}}/></label>
   <label>Localidad<select required value={locality} onChange={e=>{setLocality(e.target.value);setConfirmed(false)}}><option value="">Seleccionar</option>{localities.map(l=><option key={l.locality_code} value={l.locality_code}>{l.city}</option>)}</select></label>
   <label>Sector<select value={category} onChange={e=>setCategory(e.target.value)}><option>Restaurantes y cafeterías</option><option>Heladerías</option></select></label>
   <label>Dirección publicada<input required maxLength={500} value={address} onChange={e=>{setAddress(e.target.value);setConfirmed(false)}}/></label>
   <label>Correo comercial publicado (opcional)<input type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>URL de la fuente<input required type="url" maxLength={2048} value={source} onChange={e=>setSource(e.target.value)}/></label>
   <label>Notas<textarea maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
   <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> He comprobado que el establecimiento no figura ya en el CRM.</label>
   <button type="submit" disabled={busy||!confirmed} className="button button-dark button-sm">{busy?"Guardando…":"Crear ficha comercial"}</button>
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </form>
 </details>;
}
