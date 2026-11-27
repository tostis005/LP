"use client";
import {AppFrame} from "./AppFrame";
import {AdminMarketingUsers} from "./AdminMarketingUsers";
export function AdminUserPage({id}:{id:string}){
 return <AppFrame area="admin" title="Ficha de usuario" subtitle="Gestiona los datos y el acceso de esta cuenta.">{()=> <AdminMarketingUsers key={id} editId={id}/>}</AppFrame>;
}
