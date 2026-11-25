import {redirect} from "next/navigation";
import {adminDefaultHref} from "@/lib/admin-sections";
export default function AdminPage(){redirect(adminDefaultHref);}
