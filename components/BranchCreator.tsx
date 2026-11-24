"use client";
import {useState,type FormEvent} from "react";
import {Store,Plus} from "lucide-react";
import {db} from "@/lib/supabase";
export function BranchCreator({businessId,email,onCreated}:{businessId:string;email:string;onCreated:(id:string,selfOwned:boolean)=>void}){
 const [name,setName]=useState(""),[slug,setSlug]=useState(""),[owner,setOwner]=useState(email);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function create(e:FormEvent){e.preventDefault();setBusy(true);setError("");
  const {data,error}=await db().rpc("manager_create_branch",{p_source_business:businessId,p_name:name.trim(),p_slug:slug.trim().toLowerCase(),p_owner_email:owner.trim()});
  setBusy(false);if(error){setError(error.message);return}
  setName("");setSlug("");onCreated(data as string,owner.trim().toLowerCase()===email.toLowerCase());
 }
 return <section className="panel-card" style={{marginTop:20}}>
  <div className="panel-icon"><Store size={21}/></div>
  <h2>Crear sucursal con tarjeta independiente</h2>
  <p className="muted">Esta opción crea otro negocio real en KREYVI: tendrá su propia tarjeta, clientes, equipo, premios y estadísticas. Copiamos los colores iniciales para mantener la marca, pero no compartimos datos ni accesos.</p>
  <form className="form-stack" onSubmit={create}>
   <label>Nombre que verá el cliente<input required minLength={2} maxLength={120} value={name} onChange={e=>{setName(e.target.value);setSlug(e.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""))}} placeholder="Café Noma · Zona Río"/></label>
   <label>Identificador de la sucursal (URL)<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())} placeholder="cafe-noma-zona-rio"/></label>
   <label>Correo del propietario de esta sucursal<input required type="email" value={owner} onChange={e=>setOwner(e.target.value)} placeholder="propietario@ejemplo.com"/></label>
   <button className="button button-dark" disabled={busy}><Plus size={17}/> {busy?"Creando...":"Crear tarjeta de sucursal"}</button>
  </form>
  {error&&<div className="alert error">{error}</div>}
  <p className="tiny-note">Si el correo es el tuyo, tendrás acceso inmediato. Para otra persona, se creará una invitación que deberá aceptar tras verificar su cuenta.</p>
 </section>
}
