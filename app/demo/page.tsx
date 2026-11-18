"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {BrowserQRCodeReader,type IScannerControls} from "@zxing/browser";
import {QRCodeSVG} from "qrcode.react";
import {Activity,ArrowLeft,ArrowRight,BarChart3,Check,CheckCircle2,ChevronDown,Coffee,Download,Gift,ImagePlus,LayoutGrid,Minus,Plus,ScanLine,ShieldCheck,Store,Ticket,Trash2,UserRound,Users,Wallet,X} from "lucide-react";
import {Brand} from "@/components/Brand";
import {StampCard} from "@/components/StampCard";
import {STAMP_OPTIONS,StampMark,type StampKind} from "@/components/StampMarks";

type Role="administrador"|"gestor"|"empleado"|"cliente";
type ActivityItem={id:number;label:string;amount:number;date:string};
type DemoData={
 name:string;color:string;reward:string;total:number;balance:number;maxPerAction:number;
 icon:StampKind;stampImage:string;cardBackground:string;message:string;
 activity:ActivityItem[];
};
type ExampleBusiness={name:string;type:string;customers:number;active:boolean};
const FIRST:DemoData={
 name:"Café Noma",color:"#275642",reward:"Tu próximo café gratis",total:8,balance:4,maxPerAction:3,
 icon:"coffee",stampImage:"",cardBackground:"",message:"QUÉ BIEN QUE HAS VUELTO",
 activity:[{id:1,label:"Martina recibió 1 sello",amount:1,date:"Hoy, 10:42"},{id:2,label:"Martina recibió 2 sellos",amount:2,date:"Ayer, 16:18"},{id:3,label:"Martina recibió 1 sello",amount:1,date:"Lunes, 09:15"}]
};
const INITIAL_BUSINESSES:ExampleBusiness[]=[
 {name:"Café Noma",type:"Cafetería",customers:248,active:true},
 {name:"Brunch Club",type:"Restaurante",customers:136,active:true},
 {name:"Barba Norte",type:"Barbería",customers:89,active:true},
 {name:"Studio Verde",type:"Peluquería",customers:172,active:true}
];
const profiles:{id:Role;label:string;desc:string;icon:typeof ShieldCheck}[]=[
 {id:"administrador",label:"Administrador",desc:"Vista global",icon:ShieldCheck},
 {id:"gestor",label:"Dueño",desc:"Mi negocio",icon:Store},
 {id:"empleado",label:"Personal",desc:"Escáner",icon:ScanLine},
 {id:"cliente",label:"Cliente",desc:"Mis tarjetas",icon:Wallet}
];
const PALETTE=["#275642","#24465e","#735f9b","#ad684e","#ad667d","#1f2937","#3d6c67","#7e5a45"];
function round(n:number){return Math.max(2,Math.min(24,Math.floor(n)||2))}
const dateNow=()=>new Intl.DateTimeFormat("es",{hour:"2-digit",minute:"2-digit"}).format(new Date());

export default function DemoPage(){
 const [role,setRole]=useState<Role>("gestor"),[tab,setTab]=useState("resumen"),[data,setData]=useState<DemoData>(FIRST),[ready,setReady]=useState(false);
 const [businesses,setBusinesses]=useState<ExampleBusiness[]>(INITIAL_BUSINESSES),[newBusiness,setNewBusiness]=useState(""),[filter,setFilter]=useState("");
 const [scanned,setScanned]=useState(false),[scanCount,setScanCount]=useState(1),[scanning,setScanning]=useState(false),[note,setNote]=useState("");
 const [qrOpen,setQrOpen]=useState(false);
 const video=useRef<HTMLVideoElement|null>(null),camera=useRef<IScannerControls|null>(null);
 useEffect(()=>{
  const p=new URLSearchParams(window.location.search);
  const requested=p.get("perfil") as Role;
  if(profiles.some(x=>x.id===requested))setRole(requested);
  if(p.get("codigo")==="demo-martina"){setScanned(true);setNote("QR de Martina identificado. Puedes registrar sellos de prueba.")}
  try{
   const saved=window.localStorage.getItem("lp_role_demo_v1");
   if(saved){const value=JSON.parse(saved) as Partial<DemoData>;setData({...FIRST,...value,icon:STAMP_OPTIONS.some(x=>x.id===value.icon)?value.icon as StampKind:"coffee",activity:Array.isArray(value.activity)?value.activity.slice(0,30):FIRST.activity});}
  }catch{/* modo de demostración sin almacenamiento */}
  setReady(true);
 },[]);
 useEffect(()=>{if(ready){try{window.localStorage.setItem("lp_role_demo_v1",JSON.stringify(data));}catch{/* uploads grandes pueden no guardarse en el navegador */}}},[data,ready]);
 useEffect(()=>{
  if(!scanning||!video.current)return;
  let stopped=false;
  const reader=new BrowserQRCodeReader();
  reader.decodeFromVideoDevice(undefined,video.current,result=>{
   if(result&&!stopped){
    stopped=true;camera.current?.stop();setScanning(false);
    const value=result.getText();
    if(value.includes("demo-martina")){setScanned(true);setNote("Tarjeta de Martina identificada correctamente.");}
    else setNote("El QR no es una tarjeta de prueba de esta demo. No se ha registrado ningún sello.");
   }
  }).then(c=>{if(stopped)c.stop();else camera.current=c}).catch(()=>{if(!stopped){setScanning(false);setNote("No se pudo abrir la cámara. Puedes usar el escaneo simulado.")}});
  return()=>{stopped=true;camera.current?.stop();camera.current=null};
 },[scanning]);
 function selectRole(id:Role){
  setRole(id);setTab("resumen");setNote("");setScanning(false);setQrOpen(false);
  if(typeof window!=="undefined")window.history.replaceState(null,"","/demo?perfil="+id);
 }
 function patch(change:Partial<DemoData>){setData(v=>({...v,...change}))}
 function add(delta:number){
  if(!scanned){setNote("Primero identifica la tarjeta del cliente.");return}
  const n=Math.min(Math.max(1,delta),data.maxPerAction);
  patch({balance:data.balance+n,activity:[{id:Date.now(),label:"Martina recibió "+n+" sello"+(n===1?"":"s"),amount:n,date:"Hoy, "+dateNow()},...data.activity].slice(0,30)});
  setNote("¡Listo! "+n+" sello"+(n===1?" añadido.":"s añadidos.")+" Martina ya tiene "+(data.balance+n)+".");
 }
 function redeem(){
  if(data.balance<data.total){setNote("Todavía faltan "+(data.total-data.balance)+" sellos para el premio.");return}
  patch({balance:data.balance-data.total,activity:[{id:Date.now(),label:"Martina canjeó una recompensa",amount:-data.total,date:"Hoy, "+dateNow()},...data.activity].slice(0,30)});
  setNote("Recompensa canjeada. El contador inicia un nuevo ciclo.");
 }
 function imageUpload(file:File|null,key:"stampImage"|"cardBackground"){
  if(!file)return;
  if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>900000){
   setNote("En esta demo se permiten PNG, JPG o WEBP de hasta 900 KB.");return;
  }
  const reader=new FileReader();
  reader.onload=()=>{patch({[key]:String(reader.result||"")});setNote("Imagen cargada en la vista previa.");};
  reader.readAsDataURL(file);
 }
 const origin=typeof window!=="undefined"?window.location.origin:"https://example.com";
 const joinQr=origin+"/demo?perfil=cliente";
 const personalQr=origin+"/demo?perfil=empleado&codigo=demo-martina";
 const complete=data.balance>=data.total;
 const pageTitle=role==="administrador"?"Toda tu comunidad, a un vistazo.":role==="gestor"?"Buenos días, Café Noma.":role==="empleado"?"Cada visita cuenta.":"¡Hola, Martina!";
 const pageSubtitle=role==="administrador"?"Controla negocios, personas y resultados desde un único lugar.":role==="gestor"?"Configura las recompensas y conoce a tus clientes.":role==="empleado"?"Escanea, añade sellos y entrega recompensas en segundos.":"Tus lugares favoritos y tus próximas recompensas, siempre contigo.";
 return <main className="role-demo-page">
  <header className="role-demo-topbar">
   <span className="role-demo-brand"><Brand/></span>
   <span className="role-demo-mode"><span/> ENTORNO DE PRUEBA · SIN DATOS REALES</span>
   <Link href="/acceder" className="role-demo-back"><ArrowLeft size={16}/> Volver al acceso</Link>
  </header>
  <div className="role-demo-frame">
   <aside className="role-demo-sidebar">
    <p className="role-demo-side-label">CAMBIAR DE PERFIL</p>
    <nav className="role-demo-nav" aria-label="Perfiles de demostración">
     {profiles.map(p=><button type="button" key={p.id} onClick={()=>selectRole(p.id)} className={role===p.id?"active":""}><p.icon size={19}/><span><strong>{p.label}</strong><small>{p.desc}</small></span>{role===p.id&&<Check size={15}/>}</button>)}
    </nav>
    <div className="role-demo-side-tip"><Gift size={21}/><strong>Una tarjeta, cuatro miradas.</strong><p>Prueba a crear sellos como dueño, dárselos como empleado y verlos como cliente.</p></div>
   </aside>
   <section className="role-demo-main">
    <div className="role-demo-mobile-tabs">{profiles.map(p=><button type="button" key={p.id} onClick={()=>selectRole(p.id)} className={role===p.id?"active":""}><p.icon size={17}/>{p.label}</button>)}</div>
    <div className="role-demo-heading"><div><span className="role-demo-eyebrow">{role==="administrador"?"PLATAFORMA":role==="gestor"?"TU RESTAURANTE":role==="empleado"?"PUNTO DE VENTA":"TU WALLET"}</span><h1>{pageTitle}</h1><p>{pageSubtitle}</p></div><span className="role-demo-day">✦ DEMO INTERACTIVA</span></div>

    {role==="administrador"&&<>
     <div className="role-demo-kpis">
      <Metric icon={<Store/>} label="Negocios de ejemplo" value={businesses.length} caption={businesses.filter(b=>b.active).length+" activos"}/>
      <Metric icon={<Users/>} label="Clientes en la red" value={businesses.reduce((s,b)=>s+b.customers,0)} caption="Datos ficticios"/>
      <Metric icon={<Ticket/>} label="Sellos de Martina" value={data.balance} caption="Café Noma"/>
      <Metric icon={<Activity/>} label="Movimientos en demo" value={data.activity.length} caption="Historial local"/>
     </div>
     <div className="role-demo-tabs"><button className={tab==="resumen"?"active":""} onClick={()=>setTab("resumen")}>Negocios</button><button className={tab==="usuarios"?"active":""} onClick={()=>setTab("usuarios")}>Usuarios</button><button className={tab==="informes"?"active":""} onClick={()=>setTab("informes")}>Informes</button></div>
     {tab==="resumen"&&<div className="role-demo-section">
      <div className="role-demo-section-head"><div><h2>Red de negocios</h2><p>Activa, suspende y añade establecimientos de prueba.</p></div><input className="role-demo-search" placeholder="Buscar negocio..." value={filter} onChange={e=>setFilter(e.target.value)}/></div>
      <div className="role-demo-table-wrap"><table className="role-demo-table"><thead><tr><th>Establecimiento</th><th>Categoría</th><th>Clientes</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{businesses.filter(b=>b.name.toLowerCase().includes(filter.toLowerCase())).map((b,i)=><tr key={i}><td><strong>{b.name}</strong></td><td>{b.type}</td><td>{b.customers}</td><td><span className={"role-demo-status"+(b.active?"":" muted")}>{b.active?"Activo":"Suspendido"}</span></td><td><button className="role-demo-textbutton" onClick={()=>setBusinesses(current=>current.map(x=>x===b?{...x,active:!x.active}:x))}>{b.active?"Suspender":"Activar"}</button></td></tr>)}</tbody></table></div>
      <form className="role-demo-inline-form" onSubmit={e=>{e.preventDefault();if(newBusiness.trim()){setBusinesses(list=>[...list,{name:newBusiness.trim(),type:"Restaurante",customers:0,active:true}]);setNewBusiness("")}}}><input value={newBusiness} onChange={e=>setNewBusiness(e.target.value)} placeholder="Nuevo negocio de prueba..." required/><button className="button button-dark"><Plus size={17}/> Añadir negocio</button></form>
     </div>}
     {tab==="usuarios"&&<section className="role-demo-section"><h2>Usuarios registrados · ejemplo</h2><p className="role-demo-muted">En el panel real esta lista incluye todos los usuarios de la plataforma, con acceso según permisos.</p><div className="role-demo-table-wrap"><table className="role-demo-table"><thead><tr><th>Cliente</th><th>Negocio</th><th>Sellos</th><th>Programa</th></tr></thead><tbody><tr><td><strong>Martina López</strong></td><td>{data.name}</td><td>{data.balance}</td><td>Sellos</td></tr><tr><td>Álvaro Ruiz</td><td>Brunch Club</td><td>3</td><td>Sellos</td></tr><tr><td>Lucía Torres</td><td>Barba Norte</td><td>5</td><td>Sellos</td></tr></tbody></table></div></section>}
     {tab==="informes"&&<Reports data={data} mode="admin"/>}
    </>}

    {role==="gestor"&&<>
     <div className="role-demo-kpis">
      <Metric icon={<Users/>} label="Clientes registrados" value={248} caption="Ejemplo de negocio"/>
      <Metric icon={<Activity/>} label="Visitas registradas" value={684} caption="Ejemplo de negocio"/>
      <Metric icon={<Gift/>} label="Premios entregados" value={37} caption="Ejemplo de negocio"/>
      <Metric icon={<Ticket/>} label="Sellos de Martina" value={data.balance} caption="Actualizados en la demo"/>
     </div>
     <div className="role-demo-tabs"><button className={tab==="resumen"?"active":""} onClick={()=>setTab("resumen")}>Resumen</button><button className={tab==="disenador"?"active":""} onClick={()=>setTab("disenador")}>Diseñar tarjeta</button><button className={tab==="clientes"?"active":""} onClick={()=>setTab("clientes")}>Clientes</button><button className={tab==="informes"?"active":""} onClick={()=>setTab("informes")}>Informes</button></div>
     {tab==="resumen"&&<div className="role-demo-two-col">
      <section className="role-demo-section"><div className="role-demo-section-head"><div><h2>Tu programa de sellos</h2><p>Una recompensa sencilla, con tu marca.</p></div></div><StampCard name={data.name} color={data.color} reward={data.reward} total={data.total} earned={data.balance} icon={data.icon} imageUrl={data.stampImage} backgroundUrl={data.cardBackground} message={data.message} qrValue={joinQr}/><div className="role-demo-actions"><button className="button button-dark" onClick={()=>setTab("disenador")}>Personalizar tarjeta <ArrowRight size={17}/></button><button className="button button-outline" onClick={()=>{navigator.clipboard?.writeText(joinQr);setNote("Enlace de prueba copiado, si el navegador lo permite.")}}>Copiar QR de acceso</button></div></section>
      <section className="role-demo-section"><h2>Últimos movimientos</h2><p className="role-demo-muted">Estos movimientos cambian cuando el empleado añade o canjea sellos.</p><ActivityList entries={data.activity}/></section>
     </div>}
     {tab==="disenador"&&<div className="role-demo-designer">
      <section className="role-demo-section role-demo-design-controls">
       <div className="role-demo-section-head"><div><h2>El estilo de tu tarjeta</h2><p>Los cambios se muestran en directo.</p></div></div>
       <label className="role-demo-field">Nombre del negocio<input maxLength={32} value={data.name} onChange={e=>patch({name:e.target.value})}/></label>
       <label className="role-demo-field">Mensaje corto<input maxLength={45} value={data.message} onChange={e=>patch({message:e.target.value})}/></label>
       <label className="role-demo-field">Premio<input maxLength={54} value={data.reward} onChange={e=>patch({reward:e.target.value})}/></label>
       <div className="role-demo-form-row"><label className="role-demo-field">Sellos para canjear<input type="number" min={2} max={24} value={data.total} onChange={e=>patch({total:round(Number(e.target.value))})}/></label><label className="role-demo-field">Máximo por compra<input type="number" min={1} max={10} value={data.maxPerAction} onChange={e=>patch({maxPerAction:Math.max(1,Math.min(10,Number(e.target.value)||1))})}/></label></div>
       <label className="role-demo-field">Color de la tarjeta</label><div className="role-demo-colors">{PALETTE.map(c=><button key={c} type="button" className={data.color===c?"selected":""} aria-label={"Elegir "+c} title={c} style={{backgroundColor:c}} onClick={()=>patch({color:c})}/>) }<label className="role-demo-custom-color" title="Otro color"><input type="color" value={data.color} onChange={e=>patch({color:e.target.value})}/></label></div>
       <label className="role-demo-field">Elige tu sello</label><div className="role-demo-icon-grid">{STAMP_OPTIONS.map(s=><button type="button" key={s.id} className={data.icon===s.id&&!data.stampImage?"selected":""} aria-pressed={data.icon===s.id&&!data.stampImage} title={s.label} onClick={()=>patch({icon:s.id,stampImage:""})}><StampMark kind={s.id} size={27}/><span>{s.label}</span></button>)}</div>
       <label className="role-demo-upload"><ImagePlus size={19}/> Subir sello propio (PNG/JPG/WEBP) <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>imageUpload(e.target.files?.[0]||null,"stampImage")}/></label>
       {data.stampImage&&<button className="role-demo-textbutton" onClick={()=>patch({stampImage:""})}>Quitar imagen personalizada</button>}
       <label className="role-demo-upload"><ImagePlus size={19}/> Añadir fondo opcional <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>imageUpload(e.target.files?.[0]||null,"cardBackground")}/></label>
       {data.cardBackground&&<button className="role-demo-textbutton" onClick={()=>patch({cardBackground:""})}>Quitar fondo</button>}
      </section>
      <div className="role-demo-preview-sticky"><section className="role-demo-section"><span className="role-demo-eyebrow">VISTA PREVIA EN DIRECTO</span><StampCard name={data.name} color={data.color} reward={data.reward} total={data.total} earned={data.balance} icon={data.icon} imageUrl={data.stampImage} backgroundUrl={data.cardBackground} message={data.message} qrValue={joinQr}/><p className="role-demo-muted">Los huecos vacíos permanecen en blanco. Cada sello ganado muestra el SVG o imagen elegida. El QR mostrado es de inscripción de prueba.</p><button className="button button-outline button-full" onClick={()=>patch({balance:0})}><Minus size={17}/> Reiniciar sellos de la demo</button></section></div>
     </div>}
     {tab==="clientes"&&<section className="role-demo-section"><h2>Tu comunidad</h2><p className="role-demo-muted">Cada negocio solo ve a sus propios clientes.</p><div className="role-demo-table-wrap"><table className="role-demo-table"><thead><tr><th>Nombre</th><th>Sellos</th><th>Recompensa</th><th>Última actividad</th></tr></thead><tbody><tr><td><strong>Martina López</strong></td><td>{data.balance} / {data.total}</td><td>{complete?"Disponible":"En progreso"}</td><td>Hoy</td></tr><tr><td>Álvaro Ruiz</td><td>2 / {data.total}</td><td>En progreso</td><td>Ayer</td></tr><tr><td>Lucía Torres</td><td>5 / {data.total}</td><td>En progreso</td><td>Esta semana</td></tr></tbody></table></div></section>}
     {tab==="informes"&&<Reports data={data} mode="business"/>}
    </>}

    {role==="empleado"&&<div className="role-demo-staff-grid">
     <section className="role-demo-section role-demo-scan-section">
      <div className="role-demo-scan-icon"><ScanLine size={28}/></div><h2>Escanea la tarjeta</h2><p className="role-demo-muted">Coloca el QR del cliente frente a la cámara o utiliza el cliente de ejemplo.</p>
      <div className="role-demo-camera">{scanning?<video ref={video} autoPlay muted playsInline/>:<><ScanLine size={62} strokeWidth={1.3}/><span>Escáner listo para usar</span><small>Sin guardar imágenes ni grabaciones</small></>}</div>
      <div className="role-demo-actions stack"><button className="button button-dark button-full" onClick={()=>setScanning(!scanning)}>{scanning?"Detener cámara":"Abrir cámara del dispositivo"} <ScanLine size={18}/></button><button className="button button-outline button-full" onClick={()=>{setScanned(true);setScanning(false);setNote("Tarjeta de Martina encontrada. Selecciona los sellos que quieras registrar.")}}>Simular escaneo de Martina <ArrowRight size={17}/></button></div>
     </section>
     <section className="role-demo-section role-demo-award">
      <span className="role-demo-eyebrow">CAJA · {data.name.toUpperCase()}</span><h2>{scanned?"Tarjeta identificada":"Esperando tarjeta"}</h2>
      {!scanned?<div className="role-demo-empty-scan"><UserRound size={40}/><p>Al escanear aparecerá el saldo y podrás registrar sellos.</p></div>:<>
       <div className="role-demo-found"><div className="role-demo-person">ML</div><div><strong>Martina López</strong><span>Cliente del programa · {data.balance} de {data.total} sellos</span></div><CheckCircle2 size={20}/></div>
       <StampCard name={data.name} color={data.color} reward={data.reward} total={data.total} earned={data.balance} icon={data.icon} imageUrl={data.stampImage} backgroundUrl={data.cardBackground} message={data.message}/>
       <label className="role-demo-field">¿Cuántos sellos asignamos?</label>
       <div className="role-demo-stepper"><button type="button" onClick={()=>setScanCount(n=>Math.max(1,n-1))} aria-label="Quitar un sello"><Minus size={22}/></button><strong>{scanCount}</strong><button type="button" onClick={()=>setScanCount(n=>Math.min(data.maxPerAction,n+1))} aria-label="Añadir un sello"><Plus size={22}/></button><small>Máx. {data.maxPerAction} por operación</small></div>
       <button className="button button-dark button-full role-demo-main-action" onClick={()=>add(scanCount)}><Plus size={19}/> Añadir {scanCount} sello{scanCount===1?"":"s"}</button>
       <button className="button button-outline button-full" disabled={!complete} onClick={redeem}><Gift size={18}/> Canjear {data.reward}</button>
       {!complete&&<p className="role-demo-muted">El canje se activará al completar los {data.total} sellos.</p>}
      </>}
      {note&&<div className="role-demo-notice"><Check size={17}/>{note}</div>}
     </section>
    </div>}

    {role==="cliente"&&<div className="role-demo-customer">
     <div className="role-demo-customer-card"><span className="role-demo-eyebrow">MIS TARJETAS · 1 ACTIVA</span><h2>Tu café favorito, más cerca.</h2><p className="role-demo-muted">Enseña tu código al personal cada vez que visites el local.</p><StampCard name={data.name} color={data.color} reward={data.reward} total={data.total} earned={data.balance} icon={data.icon} imageUrl={data.stampImage} backgroundUrl={data.cardBackground} message={data.message}/><button onClick={()=>setQrOpen(true)} className="button button-dark button-full role-demo-main-action"><ScanLine size={19}/> Mostrar mi QR personal</button></div>
     <div className="role-demo-customer-info"><section className="role-demo-section"><div className="role-demo-reward-icon"><Gift size={26}/></div><span className="role-demo-eyebrow">TU PRÓXIMO PREMIO</span><h2>{data.reward}</h2><p>{complete?"¡Enhorabuena! Ya puedes canjear tu recompensa en el local.":"Solo te faltan "+(data.total-data.balance)+" sellos para conseguirlo."}</p><div className="role-demo-progress"><div style={{width:Math.min(100,(data.balance/data.total)*100)+"%"}}/></div><strong>{Math.min(data.balance,data.total)} / {data.total} sellos</strong></section><section className="role-demo-section"><h2>Tu actividad reciente</h2><ActivityList entries={data.activity}/></section></div>
    </div>}
    {note&&role!=="empleado"&&<div className="role-demo-global-notice"><Check size={17}/>{note}<button aria-label="Cerrar" onClick={()=>setNote("")}><X size={16}/></button></div>}
    <p className="role-demo-bottom-note">Esta es una demostración local para evaluar el diseño. Las cuentas reales, los permisos y los movimientos se gestionan en el entorno protegido de LoiaG.</p>
   </section>
  </div>
  {qrOpen&&role==="cliente"&&<div className="role-demo-overlay" onMouseDown={()=>setQrOpen(false)}><div className="role-demo-qr-modal" role="dialog" aria-modal="true" aria-label="Tu QR personal" onMouseDown={e=>e.stopPropagation()}><button className="role-demo-close" aria-label="Cerrar" onClick={()=>setQrOpen(false)}><X size={23}/></button><span className="role-demo-eyebrow">MI TARJETA PERSONAL</span><h2>Martina López</h2><p>Muéstralo al personal de {data.name}</p><div className="role-demo-qr-big"><QRCodeSVG value={personalQr} size={205} includeMargin level="M"/></div><strong>{data.balance} de {data.total} sellos</strong><small>QR de prueba · no corresponde a una cuenta real</small><button className="button button-dark button-full" onClick={()=>{setQrOpen(false);selectRole("empleado");setScanned(true);setNote("QR personal de Martina identificado.")}}>Probar escaneo como empleado <ArrowRight size={17}/></button></div></div>}
 </main>;
}
function Metric({icon,label,value,caption}:{icon:React.ReactNode;label:string;value:number|string;caption:string}){
 return <div className="role-demo-metric"><div className="role-demo-metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{caption}</small></div>;
}
function ActivityList({entries}:{entries:ActivityItem[]}){
 return <div className="role-demo-feed">{entries.map(a=><div className="role-demo-feed-row" key={a.id}><span className={"role-demo-feed-icon"+(a.amount<0?" redeemed":"")}>{a.amount<0?<Gift size={18}/>:<Check size={18}/>}</span><div><strong>{a.label}</strong><small>{a.date}</small></div><b>{a.amount>0?"+":""}{a.amount}</b></div>)}</div>;
}
function Reports({data,mode}:{data:DemoData;mode:"admin"|"business"}){
 const bars=[42,68,47,79,59,92,75];
 return <div className="role-demo-two-col"><section className="role-demo-section"><h2>Visitas durante la semana</h2><p className="role-demo-muted">Representación ilustrativa, no estadísticas reales.</p><div className="role-demo-bars">{bars.map((x,i)=><div key={i}><div style={{height:x+"%"}}/><small>{["L","M","X","J","V","S","D"][i]}</small></div>)}</div></section><section className="role-demo-section"><h2>{mode==="admin"?"Visión de la red":"Rendimiento del programa"}</h2><div className="role-demo-report-row"><span>Tarjetas activas</span><strong>{mode==="admin"?"645":"248"}</strong></div><div className="role-demo-report-row"><span>Recompensa configurada</span><strong>{data.reward}</strong></div><div className="role-demo-report-row"><span>Sellos para canjear</span><strong>{data.total}</strong></div><div className="role-demo-report-row"><span>Saldo de Martina</span><strong>{data.balance}</strong></div><p className="role-demo-muted">En el producto real, los informes se generan a partir de operaciones verificadas.</p></section></div>;
}
