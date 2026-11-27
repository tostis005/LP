"use client";
const fields:Array<[string,string]>=[
 ["marca","Marca"],["sucursal","Sucursal"],["operador","Operador"],["nombre_alternativo","Nombre alternativo"],
 ["horario","Horario"],["cocina","Tipo de cocina"],["descripcion","Descripción"],["codigo_postal","Código postal"],
 ["distrito","Distrito"],["edificio","Edificio/local"],["piso","Piso"],
 ["movil","Móvil adicional"],["telefono_operador","Teléfono del operador"],["marca_email","Correo de la marca"],["marca_web","Web de la marca"],
 ["twitter","X / Twitter"],["youtube","YouTube"],["linkedin","LinkedIn"],["tiktok","TikTok"],["telegram","Telegram"],["menu","Carta / menú"],
 ["delivery","Entrega a domicilio"],["takeaway","Para llevar"],["reservas","Reservas"],["desayuno","Desayuno"],["terraza","Terraza"],["wifi","Wi-Fi"],["servicio_auto","Servicio al auto"],["mascotas_permitidas","Admite mascotas"],["accesibilidad","Accesibilidad"],["capacidad","Capacidad"],["forma_pago","Formas de pago"],["monedas","Monedas"],["fecha_apertura","Fecha de apertura"],["segmento","Segmento"],["prioridad","Prioridad comercial"],["fecha_extracto","Fecha del extracto"],["fecha_comprobacion_osm","Fecha de revisión OSM"],["estado_verificacion","Verificación"]
];
function hrefFor(key:string,value:string,blocked:boolean){
 if(blocked)return undefined;
 if(["movil","telefono_operador"].includes(key)&&/^\+?[\d\s().-]+$/.test(value))return "tel:"+value.replace(/[^\d+]/g,"");
 if(key==="marca_email"&&/^[^\s@,;<>?#&]+@[^\s@,;<>?#&]+\.[^\s@,;<>?#&]+$/.test(value))return "mailto:"+value;
 const hosts:Record<string,string[]>={twitter:["twitter.com","www.twitter.com","x.com","www.x.com"],youtube:["youtube.com","www.youtube.com","youtu.be","m.youtube.com"],linkedin:["linkedin.com","www.linkedin.com"],tiktok:["tiktok.com","www.tiktok.com"],telegram:["t.me","telegram.me"]};
 if(!(key in hosts)&&!["marca_web","menu"].includes(key))return undefined;
 if(key==="twitter"&&/^@?[a-z0-9_]{1,15}$/i.test(value))return "https://x.com/"+value.replace(/^@/,"");
 if(key==="telegram"&&/^@?[a-z0-9_]{5,32}$/i.test(value))return "https://t.me/"+value.replace(/^@/,"");
 try{const u=new URL(/^[a-z][a-z0-9+.-]*:/i.test(value)?value:"https://"+value);return ["http:","https:"].includes(u.protocol)&&!u.username&&!u.password&&(!(key in hosts)||hosts[key].includes(u.hostname))?u.href:undefined;}catch{return undefined;}
}
export function CrmOsmDetails({data,blocked=false}:{data?:Record<string,string>|null;blocked?:boolean}){
 if(!data||data.fuente!=="OpenStreetMap")return null;
 const available=fields.filter(([key])=>!!data[key]);
 if(!available.length)return null;
 return <details className="crm-contact-section"><summary>Más información de OpenStreetMap ({available.length})</summary><div className="form-stack">{available.map(([key,label])=>{const value=data[key],href=hrefFor(key,value,blocked);return <div key={key}><small className="muted">{label}</small><div style={{overflowWrap:"anywhere"}}>{href?<a href={href} target={href.startsWith("http")?"_blank":undefined} rel="noopener noreferrer">{value}</a>:value}</div></div>;})}</div><p className="muted">Datos del directorio, no verificados externamente. © colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>.</p></details>;
}
