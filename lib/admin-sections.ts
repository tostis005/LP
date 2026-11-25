export const adminSections = {
  "negocios": { tab: "business", title: "Negocios" },
  "usuarios": { tab: "users", title: "Usuarios" },
  "solicitudes": { tab: "leads", title: "Solicitudes" },
  "crm": { tab: "crm", title: "CRM comercial" },
  "marketing": { tab: "campaigns", title: "Marketing de plataforma" },
  "facturacion": { tab: "invoices", title: "Facturación campañas" },
  "informes": { tab: "reports", title: "Informes" },
} as const;
export type AdminSection = keyof typeof adminSections;
export type AdminTab = (typeof adminSections)[AdminSection]["tab"];
export function isAdminSection(value:string): value is AdminSection {
  return Object.prototype.hasOwnProperty.call(adminSections,value);
}
export const adminDefaultHref = "/admin/negocios";
