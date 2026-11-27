"use client";
import {Fragment,useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {DirectoryHead,DirectoryPager,useDirectoryTable} from "./DirectoryTable";
import type {TableColumn} from "@/lib/table-directory";
import {dateShort} from "@/lib/format";
import {Store,ArrowLeft,Plus,ShieldCheck,Eye,EyeOff,ChevronDown,Pencil} from "lucide-react";
import {db} from "@/lib/supabase";
import {appendScope,scopesForSave,emptyScope,scopeKey,type MarketingScope as Scope} from "@/lib/marketing-scopes";
type Region=Scope&{state:string;municipality:string;city:string};
import {staffBusinesses,loyaltySubscriptions,matchesBusiness,staffBusinessNames,type BusinessLink} from "@/lib/admin-user-affiliations";
type User={id:string;email:string;name:string|null;role:string;active:boolean|null;scopes:Scope[]|null;businesses:number;joined_at:string|null;whatsapp:string;birth_date:string|null;gender:string|null;confirmed:boolean;qa:boolean;business_links:BusinessLink[]};
type Key="name"|"email"|"role"|"businesses"|"business"|"joined_at"|"visibility";
type Program={business_id:string;balance:number;businesses:{name:string;slug:string}|null};
const blank=emptyScope;
function passwordValidation(password:string,confirmation:string,optional:boolean){if(optional&&!password&&!confirmation)return "";if(password.length<10||password.length>128)return "La contraseña debe tener entre 10 y 128 caracteres.";if(password!==confirmation)return "Las contraseñas no coinciden.";return "";}
const roles:Record<string,string>={admin:"Administrador",marketing:"Marketing",owner:"Propietario",manager:"Gestor",employee:"Empleado",customer:"Cliente"};
export function AdminMarketingUsers({editId}:{editId?:string}={}){
 const router=useRouter();
 const [users,setUsers]=useState<User[]>([]),[regions,setRegions]=useState<Region[]>([]),[editing,setEditing]=useState(false),[email,setEmail]=useState(""),[name,setName]=useState(""),[existing,setExisting]=useState(false),[userId,setUserId]=useState<string|null>(null),[initialPassword,setInitialPassword]=useState(""),[passwordVisible,setPasswordVisible]=useState(false),[active,setActive]=useState(true),[scopes,setScopes]=useState<Scope[]>([]),[draft,setDraft]=useState<Scope>(blank),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true),[focusUser,setFocusUser]=useState<User|null>(null),[programs,setPrograms]=useState<Program[]>([]),[programLoading,setProgramLoading]=useState(false),[programError,setProgramError]=useState("");
 const [editingUser,setEditingUser]=useState<User|null>(null),[whatsapp,setWhatsapp]=useState(""),[birthDate,setBirthDate]=useState(""),[gender,setGender]=useState("");
 const [regionsReady,setRegionsReady]=useState(false),[regionsError,setRegionsError]=useState(""),[newPassword,setNewPassword]=useState(""),[confirmPassword,setConfirmPassword]=useState(""),[resetVisible,setResetVisible]=useState(false),[passwordError,setPasswordError]=useState("");
 async function load(){setLoading(true);setError("");try{const r=await fetch("/api/local/admin/marketing-users?view=users"+(editId?"&userId="+encodeURIComponent(editId):""),{cache:"no-store"}),j=await r.json();if(!r.ok)throw Error(j.error);const list:User[]=j.users.map((u:User)=>({...u,scopes:Array.isArray(u.scopes)?u.scopes.map(s=>({...blank,...s})):[]}));setUsers(list);if(editId){const target=list.find(u=>u.id===editId);if(!target)throw Error("No se ha encontrado el usuario.");open(target);}}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{void load();if(!editId&&new URLSearchParams(window.location.search).get("updated")==="1")setNotice("Usuario actualizado correctamente.");},[editId]);
 const marketingEditor=!existing||editingUser?.role==="marketing";
 const needsRegions=(editing&&marketingEditor)||users.some(u=>u.role==="marketing");
 useEffect(()=>{if(!needsRegions||regionsReady)return;const controller=new AbortController();setRegionsError("");fetch("/api/local/admin/marketing-users?view=regions",{cache:"no-store",signal:controller.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);if(!controller.signal.aborted){setRegions(j.regions.map((r:Region)=>({...r,neighborhood:r.neighborhood||"",locality_code:r.locality_code||""})));setRegionsReady(true);}}).catch(e=>{if(!controller.signal.aborted)setRegionsError(e.message);});return()=>controller.abort();},[needsRegions,regionsReady]);
 function clearPassword(){setNewPassword("");setConfirmPassword("");setResetVisible(false);setPasswordError("");}
 useEffect(()=>{if(!focusUser)return;let current=true;setProgramLoading(true);setPrograms([]);setProgramError("");
  void (async()=>{try{const {data,error}=await db().from("loyalty_memberships").select("business_id,balance,businesses(name,slug)").eq("customer_id",focusUser.id);if(error)throw error;if(current)setPrograms((data||[]) as unknown as Program[]);}catch(e){if(current)setProgramError((e as Error).message);}finally{if(current)setProgramLoading(false);}})();
  return ()=>{current=false;};
 },[focusUser]);
 function backToDirectory(){clearPassword();setInitialPassword("");setError("");if(editId){router.push("/admin/usuarios");return;}setEditing(false);}
 function open(u?:User){clearPassword();setFocusUser(null);setEditing(true);setExisting(!!u);setEditingUser(u||null);setWhatsapp(u?.whatsapp||"");setBirthDate(u?.birth_date?.slice(0,10)||"");setGender(u?.gender||"");setUserId(u?.id||null);setInitialPassword("");setPasswordVisible(false);setEmail(u?.email||"");setName(u?.name||"");setActive(u?.active??true);setScopes((u?.scopes||[]).map(s=>({...blank,...s})));setDraft(blank);setNotice("");setError("");}
 async function save(){
  if(busy)return;setError("");setPasswordError("");
  if(existing){const invalid=passwordValidation(newPassword,confirmPassword,true);if(invalid){setPasswordError(invalid);return;}}
  if(existing&&email.trim().toLowerCase()!==editingUser?.email.toLowerCase()&&!editingUser?.qa&&!confirm("El nuevo correo deberá confirmarse antes de volver a iniciar sesión. ¿Continuar?"))return;
  setBusy(true);
  try{
   const payload=existing?{userId,email,name,whatsapp,birthDate,gender,newPassword,...(marketingEditor?{active,scopes:scopesForSave(scopes,draft)}:{})}:{email,name,active,scopes:scopesForSave(scopes,draft),userId:null,initialPassword,newPassword:"",invite:!initialPassword};
   const r=await fetch("/api/local/admin/marketing-users",{method:existing?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}),j=await r.json();
   if(!r.ok)throw Error(j.error);
   if(j.relogin){clearPassword();window.alert("Cuenta actualizada. "+(j.invitation||"Inicia sesión con tus credenciales actualizadas."));window.location.assign("/acceder");return;}
   setInitialPassword("");setDraft(blank);setNotice((existing?"Usuario actualizado. ":"Usuario creado. ")+(j.passwordChanged?"Contraseña actualizada y sesiones anteriores cerradas. ":"")+(j.invitation||""));clearPassword();if(editId){if(j.invitation)window.alert(j.invitation);router.push("/admin/usuarios?updated=1");return;}setEditing(false);await load();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const fields:[keyof Scope,string][]=[["country_code","País"],["state_code","Estado"],["municipality_code","Municipio"],["locality_code","Localidad"],["neighborhood","Colonia"]];
 function options(i:number){const k=fields[i][0];const rs=regions.filter(r=>fields.slice(0,i).every(([f])=>r[f]===draft[f]));return [...new Map(rs.filter(r=>r[k]).map(r=>[r[k],k==="country_code"&&r[k]==="MX"?"México":k==="state_code"?r.state:k==="municipality_code"?r.municipality:k==="locality_code"?r.city:r[k]])).entries()];}
 function describe(s:Scope){const r=regions.find(r=>fields.every(([k])=>!s[k]||r[k]===s[k]));return [s.country_code==="MX"?"México":s.country_code,s.state_code&&(r?.state||s.state_code),s.municipality_code&&(r?.municipality||s.municipality_code),s.locality_code&&(r?.city||s.locality_code),s.neighborhood].filter(Boolean).join(" / ")||"Todo el CRM";}
 function visibility(u:User){return u.role==="marketing"?u.active?(u.scopes?.map(describe).join(" · ")||"Sin ámbitos"):"Desactivado":"—";}
 const businessOptions=[...new Map(users.flatMap(u=>staffBusinesses(u).map(b=>[b.id,b.name] as const))).entries()].sort((a,b)=>a[1].localeCompare(b[1],"es"));
 const columns:TableColumn<User,Key>[]=[
  {key:"name",label:"Nombre",value:u=>u.name||""},
  {key:"email",label:"Correo",value:u=>u.email},
  {key:"role",label:"Rol",value:u=>roles[u.role]||u.role,search:u=>u.role,filter:"select",options:Object.entries(roles)},
  {key:"business",label:"Negocio",value:staffBusinessNames,filter:"select",options:businessOptions,matches:matchesBusiness},
  {key:"businesses",label:"Programas",value:u=>loyaltySubscriptions(u).length,filter:"number"},
  {key:"joined_at",label:"Fecha de alta",value:u=>u.joined_at,search:u=>u.joined_at?u.joined_at.slice(0,10):"",filter:"date"},
  {key:"visibility",label:"Visibilidad",value:visibility}
 ];
 const table=useDirectoryTable(users,columns,{key:"name",direction:"asc"});
 if(editId&&!editing)return <section className="panel-card"><Link className="campaign-editor-back" href="/admin/usuarios"><ArrowLeft size={16}/> Volver a usuarios</Link>{loading?<p role="status">Cargando usuario…</p>:<p role="alert" className="alert error">{error||"Usuario no encontrado."}</p>}</section>;
 if(editing)return <section className="panel-card marketing-user-editor"><button type="button" className="campaign-editor-back" disabled={busy} onClick={backToDirectory}><ArrowLeft size={16}/> Volver a usuarios</button>
 <div className="content-heading"><div><h2>{existing?"Editar usuario":"Crear usuario de marketing"}</h2><p className="muted">{existing?("Perfil: "+(roles[editingUser?.role||""]||editingUser?.role||"Usuario")):"Define la cuenta y los ámbitos del CRM a los que tendrá acceso."}</p></div><span className="marketing-editor-icon"><ShieldCheck size={25}/></span></div>
 <form className="form-stack" style={{display:"grid",gap:24}} onSubmit={e=>{e.preventDefault();void save();}}>
 <div className="marketing-editor-section"><h3>Datos de la cuenta</h3><div className="marketing-editor-fields"><label>Nombre<input required={!existing} minLength={existing?undefined:2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre y apellidos"/></label><label>Correo electrónico<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nombre@correo.com"/></label></div>
 {existing&&<><div className="marketing-editor-fields"><label>Teléfono (prefijo internacional)<input type="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="+526641234567"/></label><label>Fecha de nacimiento<input type="date" min="1900-01-01" max={new Date().toISOString().slice(0,10)} value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></label><label>Género<select value={gender} onChange={e=>setGender(e.target.value)}><option value="">Sin indicar</option><option value="woman">Mujer</option><option value="man">Hombre</option><option value="other">Otro</option></select></label></div><p className="muted">Correo {editingUser?.confirmed?"confirmado":"pendiente de confirmar"}.</p><h3>Negocios a los que pertenece</h3><div className="marketing-scope-list">{editingUser&&staffBusinesses(editingUser).length?staffBusinesses(editingUser).map((b,i)=><div key={b.id+":"+b.role+":"+i}><span>{b.name} · {roles[b.role]||b.role}{b.active?"":" (inactivo)"}</span></div>):<p className="muted">No pertenece al personal de ningún negocio.</p>}</div></>}
 {!existing&&<div className="marketing-password-field"><label>Contraseña inicial (opcional)<div className="password-input"><input type={passwordVisible?"text":"password"} autoComplete="new-password" minLength={10} maxLength={128} value={initialPassword} onChange={e=>setInitialPassword(e.target.value)} placeholder="Mínimo 10 caracteres"/><button type="button" aria-label={passwordVisible?"Ocultar contraseña":"Mostrar contraseña"} onClick={()=>setPasswordVisible(v=>!v)}>{passwordVisible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label><small className="muted">Si la estableces, el usuario podrá iniciar sesión con ella desde el primer momento. Comunícala por un canal seguro. Si la dejas vacía, recibirá una invitación para crear su propia contraseña.</small></div>}
 {marketingEditor&&<label className="marketing-active-control"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/><span><strong>Acceso activo</strong><small>Permitir que este usuario acceda al CRM dentro de sus ámbitos.</small></span></label>}</div>
 {existing&&<section className="marketing-editor-section form-stack" aria-label="Contraseña de acceso">
  <h3>Contraseña de acceso</h3><p className="muted">Establece o cambia la contraseña de {email}. Déjala vacía si no quieres cambiarla. Se guardará junto al resto de cambios.</p>
  <div className="marketing-editor-fields">
   <div className="marketing-password-field"><label>Nueva contraseña<div className="password-input"><input autoComplete="new-password" type={resetVisible?"text":"password"} maxLength={128} disabled={busy} name="new-password" value={newPassword} onChange={e=>{setNewPassword(e.target.value);setPasswordError("");}} placeholder="Mínimo 10 caracteres"/><button type="button" aria-label={resetVisible?"Ocultar contraseña":"Mostrar contraseña"} onClick={()=>setResetVisible(v=>!v)}>{resetVisible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label></div>
   <label>Confirmar contraseña<input autoComplete="new-password" type={resetVisible?"text":"password"} maxLength={128} disabled={busy} name="confirm-password" value={confirmPassword} onChange={e=>{setConfirmPassword(e.target.value);setPasswordError("");}} placeholder="Repite la contraseña"/></label>
  </div>
  {(newPassword||confirmPassword)&&<small className="muted">{newPassword.length<10?`${newPassword.length}/10 caracteres mínimos`:newPassword!==confirmPassword?"Las contraseñas no coinciden.":"Las contraseñas coinciden."}</small>}
  <small className="muted">La contraseña anterior dejará de funcionar y se cerrarán las sesiones existentes. Comunica la nueva contraseña por un canal seguro.</small>
 </section>}
 {marketingEditor&&<div className="marketing-editor-section"><h3>Ámbitos geográficos</h3><p className="muted">Sin zonas asignadas no se mostrará ningún negocio. Selecciona una zona y guarda; también puedes añadir varias. Para conceder acceso global, pulsa expresamente Añadir ámbito: Todo el CRM.</p>
 {!regionsReady&&<p role="status" className="muted">{regionsError||"Cargando zonas geográficas…"}</p>}<div className="marketing-scope-fields">{fields.map(([k,label],i)=><label key={k}>{label}<select disabled={!regionsReady||(i>0&&!draft[fields[i-1][0]])} value={draft[k]} onChange={e=>{const next={...draft,[k]:e.target.value};for(const [f] of fields.slice(i+1))next[f]="";setDraft(next);}}><option value="">Todos</option>{options(i).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>)}</div>
 <button type="button" className="button button-outline" disabled={!regionsReady} onClick={()=>{if(!draft.country_code&&!confirm("¿Conceder acceso a todos los países y negocios del CRM?"))return;setScopes(old=>appendScope(old,draft));setDraft(blank);}}><Plus size={16}/> Añadir ámbito: {describe(draft)}</button>
 {draft.country_code&&<p className="muted">Se guardará también: <strong>{describe(draft)}</strong>.</p>}
 <div className="marketing-scope-list">{scopes.length?scopes.map((s,i)=><div key={scopeKey(s)}><span>{describe(s)}</span><button type="button" className="inline-table-button" onClick={()=>setScopes(scopes.filter((_,j)=>i!==j))}>Quitar</button></div>):<p className="muted">Aún no hay ámbitos añadidos.</p>}</div></div>}
 {passwordError&&<p role="alert" className="alert error">{passwordError}</p>}{error&&<p role="alert" className="alert error">{error}</p>}
 <div className="marketing-editor-actions"><button type="button" className="button button-outline" disabled={busy} onClick={backToDirectory}>Cancelar</button><button className="button button-dark" type="submit" disabled={busy}>{busy?"Guardando…":existing?"Guardar cambios":initialPassword?"Crear usuario":"Crear e invitar"}</button></div></form></section>;
 return <section className="panel-card admin-users-directory"><div className="content-heading"><div><h2>Usuarios y permisos</h2><p className="muted">Todas las cuentas de Kreyvi, sus roles, programas y ámbitos de marketing.</p></div><button className="button button-dark" onClick={()=>open()}><Plus size={17}/> Crear usuario de marketing</button></div>
 {error&&<p role="alert" className="alert error">{error}</p>}{notice&&<p role="status" className="alert success">{notice}</p>}
 <div className="table-wrap"><table className="data-table directory-table"><DirectoryHead columns={columns} table={table}/><tbody>{table.visible.map(u=>{
  const expanded=focusUser?.id===u.id,hasPrograms=loyaltySubscriptions(u).length>0;
  return <Fragment key={u.id}><tr><td><strong>{u.name||"Sin nombre"}</strong></td><td>{u.email}</td><td><span className="table-pill">{roles[u.role]||u.role}</span></td><td>{staffBusinessNames(u)||"—"}</td><td>{loyaltySubscriptions(u).length}</td><td>{u.joined_at?dateShort(u.joined_at):"—"}</td><td className="directory-visibility">{visibility(u)}</td><td><div className="admin-user-row-actions">
   {hasPrograms&&<button type="button" className="admin-user-action" title={expanded?"Ocultar programas":"Ver programas"} aria-label={(expanded?"Ocultar programas de ":"Ver programas de ")+u.email} aria-expanded={expanded} aria-controls={expanded?"programs-"+u.id:undefined} onClick={()=>{setPrograms([]);setProgramError("");setProgramLoading(!expanded);setFocusUser(expanded?null:u);}}><ChevronDown size={17} className={expanded?"admin-user-chevron expanded":"admin-user-chevron"}/></button>}
   <Link className="admin-user-action" href={"/admin/usuarios/"+encodeURIComponent(u.id)} title="Editar usuario" aria-label={"Editar usuario "+u.email}><Pencil size={16}/></Link>
  </div></td></tr>
  {expanded&&hasPrograms&&<tr className="admin-user-program-row" id={"programs-"+u.id}><td colSpan={8}><div className="admin-user-programs"><strong>Programas de fidelización</strong>{programLoading?<p role="status" className="muted">Cargando programas…</p>:programError?<p role="alert" className="alert error">{programError}</p>:programs.length?<div className="admin-user-program-list">{programs.map(p=><div className="admin-user-program" key={p.business_id}><Store size={17}/><span>{p.businesses?.name||loyaltySubscriptions(u).find(b=>b.id===p.business_id)?.name||p.business_id}</span><small>Saldo: {p.balance}</small></div>)}</div>:<p className="muted">No figura en ningún programa.</p>}</div></td></tr>}
  </Fragment>;
 })}{!table.visible.length&&<tr><td colSpan={8}>{loading?"Cargando usuarios…":error?"No se ha podido cargar el directorio.":"No hay usuarios con esos filtros."}</td></tr>}</tbody></table></div>
 <DirectoryPager table={table}/>
 </section>;
}
