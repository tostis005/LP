"use client";
import {useEffect,useState} from "react";
type Status={active:number;expires_at:string|null};
export function AdminCrmIntegration(){
 const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 async function refresh(){try{const r=await fetch("/api/local/admin/crm/integration",{cache:"no-store"}),j=await r.json();if(!r.ok)throw Error(j.error||"No se pudo consultar la conexión.");setStatus(j);}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void refresh();},[]);
 async function revoke(){
  if(!window.confirm("¿Revocar todos los permisos de investigación del CRM concedidos desde tu cuenta?"))return;
  setBusy(true);setError("");setNotice("");
  try{const r=await fetch("/api/local/admin/crm/integration",{method:"DELETE"}),j=await r.json();if(!r.ok)throw Error(j.error);setNotice("Permisos revocados.");await refresh();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <details><summary><strong>Conexión privada con ChatGPT</strong></summary>
  <p>Permiso limitado a consultar los pendientes y registrar revisiones de Tecate. No permite enviar correos ni acceder a clientes.</p>
  <p>Servidor MCP: <code>https://kreyvi.com/api/mcp/crm</code></p>
  <p>Cliente OAuth: <code>kreyvi-crm-chatgpt</code> (cliente público, PKCE S256).</p>
  <p>El acceso requiere consentimiento y caduca en una hora. No introduzcas contraseñas ni tokens en el chat.</p>
  <p>Autorizaciones activas: {status?.active??"—"}{status?.expires_at?" · Caducidad: "+new Date(status.expires_at).toLocaleString("es-MX"):""}</p>
  <button type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>void revoke()}>Revocar autorizaciones</button>
  <button type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>void refresh()}>Actualizar estado</button>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </details>;
}
