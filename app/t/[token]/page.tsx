import {redirect} from "next/navigation";
export default async function TicketPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 if(!/^[a-f0-9-]{36}$/i.test(token))redirect("/empleado");
 redirect("/empleado?code="+encodeURIComponent(token));
}
