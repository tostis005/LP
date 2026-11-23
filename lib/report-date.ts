/** Fecha del informe: PostgreSQL puede serializar DATE o timestamp ISO. */
export function reportDateLabel(raw:unknown){
 const day=/^\d{4}-\d{2}-\d{2}/.exec(String(raw||""))?.[0];
 if(!day)return "—";
 const date=new Date(day+"T12:00:00Z");
 return Number.isNaN(date.getTime())?"—":
  new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"short",timeZone:"UTC"}).format(date);
}
