export type BusinessLink={id:string;name:string;role:string;active:boolean};
type UserAffiliations={role:string;business_links?:BusinessLink[]|null};
const staffRoles=new Set(["owner","manager","employee"]);
// A subscription is not employment. Only active staff of a business belong to it.
export function staffBusinesses(user:UserAffiliations):BusinessLink[]{
 if(!staffRoles.has(user.role))return [];
 return (user.business_links||[]).filter(link=>link.active&&staffRoles.has(link.role));
}
export function loyaltySubscriptions(user:UserAffiliations):BusinessLink[]{
 return (user.business_links||[]).filter(link=>link.role==="customer");
}
export function matchesBusiness(user:UserAffiliations,id:string):boolean{
 return staffBusinesses(user).some(link=>link.id===id);
}
export function staffBusinessNames(user:UserAffiliations):string{
 return [...new Set(staffBusinesses(user).map(link=>link.name))].join(" · ");
}
