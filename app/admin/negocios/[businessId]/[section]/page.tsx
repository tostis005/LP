import {notFound} from "next/navigation";
import {isAdminBusinessSection} from "@/lib/admin-sections";
import AdminBusinessWorkspace from "@/components/AdminBusinessWorkspace";
export default async function Page({params}:{params:Promise<{businessId:string;section:string}>}){
 const {businessId,section}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId)||!isAdminBusinessSection(section))notFound();
 return <AdminBusinessWorkspace businessId={businessId}/>;
}
