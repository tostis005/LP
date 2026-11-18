import {redirect} from "next/navigation";
export default async function RewardPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(token))redirect("/empleado");
 redirect("/empleado?reward="+encodeURIComponent(token));
}
