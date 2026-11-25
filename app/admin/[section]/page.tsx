import {notFound} from "next/navigation";
import AdminWorkspace from "@/components/AdminWorkspace";
import {isAdminSection} from "@/lib/admin-sections";

export default async function AdminSectionPage({params}:{params:Promise<{section:string}>}){
 const {section}=await params;
 if(!isAdminSection(section))notFound();
 return <AdminWorkspace section={section}/>;
}
