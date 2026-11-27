export const adminSections = {
  "negocios": { tab: "business", title: "Negocios", short: "Negocios", icon: "comercio" },
  "usuarios": { tab: "users", title: "Usuarios", short: "Usuarios", icon: "perfil" },
  "solicitudes": { tab: "leads", title: "Solicitudes", short: "Solicitudes", icon: "campanas" },
  "crm": { tab: "crm", title: "CRM comercial", short: "CRM", icon: "buscar" },
  "marketing": { tab: "campaigns", title: "Marketing de plataforma", short: "Marketing", icon: "campanas" },
  "facturacion": { tab: "invoices", title: "Facturación campañas", short: "Facturación", icon: "mi-tarjeta" },
  "informes": { tab: "reports", title: "Informes", short: "Informes", icon: "recompensa" },
} as const;
export type AdminSection = keyof typeof adminSections;
export type AdminTab = (typeof adminSections)[AdminSection]["tab"];
export function isAdminSection(value:string): value is AdminSection {
  return Object.prototype.hasOwnProperty.call(adminSections,value);
}
export const adminDefaultHref = "/admin/negocios";

export const adminNavigation = Object.entries(adminSections).map(([slug,section])=>({href:"/admin/"+slug,label:section.title,short:section.short,icon:section.icon}));
export function adminActiveHref(path:string){
 const section=path.split("/")[2]||"negocios";
 if(section==="lista-espera")return "/admin/solicitudes";
 return isAdminSection(section)?"/admin/"+section:adminDefaultHref;
}
export const adminBusinessSections = {overview:"Tarjeta actual",tarjeta:"Diseñar tarjeta",poster:"QR para mostrador",marketing:"Campañas",team:"Empleados",settings:"Información",locations:"Ubicación",reports:"Datos",customers:"Clientes",transactions:"Transacciones"} as const;
export type AdminBusinessSection=keyof typeof adminBusinessSections;
export function isAdminBusinessSection(section:string):section is AdminBusinessSection{return Object.prototype.hasOwnProperty.call(adminBusinessSections,section)}
export function adminBusinessHref(id:string,section:AdminBusinessSection="overview"){return "/admin/negocios/"+encodeURIComponent(id)+"/"+section}
export function managedBusinessHref(id:string|undefined,ownerHref:string){
 if(!id)return ownerHref;
 const section=ownerHref.split("?")[0].split("/")[2]||"overview";
 return adminBusinessHref(id,section==="vista-previa"?"overview":isAdminBusinessSection(section)?section:"overview");
}
