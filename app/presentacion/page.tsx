import Home from "../page";

// Ruta pública aislada para impedir que el enrutador de acceso sustituya la portada.
export const dynamic = "force-dynamic";

export default function Presentation(){
 return <Home/>;
}
