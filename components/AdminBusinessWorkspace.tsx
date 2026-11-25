"use client";
import {AppFrame} from "@/components/AppFrame";
import BusinessWorkspace from "@/components/BusinessWorkspace";
export default function AdminBusinessWorkspace({businessId}:{businessId:string}){
 return <AppFrame area="admin" title="Gestionar negocio" subtitle="">{account=><div className="workspace-business admin-merchant-support"><BusinessWorkspace key={businessId} account={account} adminBusinessId={businessId}/></div>}</AppFrame>;
}
