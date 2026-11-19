"use client";
import {BellRing} from "lucide-react";
import {AppFrame} from "@/components/AppFrame";
import {PushPreferences} from "@/components/PushPreferences";

export default function CustomerNotificationsPage(){
 return <AppFrame area="customer" title="Notificaciones" subtitle="Activa los avisos de tus negocios favoritos en este teléfono.">
  {()=> <div className="customer-notification-settings">
    <div className="panel-card push-howto">
     <div className="panel-icon"><BellRing size={22}/></div>
     <h2>¿Cómo recibo notificaciones?</h2>
     <p className="muted">1. Pulsa «Activar push en este dispositivo» y acepta el permiso del teléfono. 2. Activa los negocios de los que quieras recibir promociones. 3. Ya puedes recibir mensajes incluso con Loyally cerrada.</p>
     <p className="tiny-note">Si todavía no tienes tarjetas, descubre un negocio y guarda su tarjeta primero. En iPhone necesitas abrir Loyally desde el icono añadido a la pantalla de inicio.</p>
    </div>
    <PushPreferences/>
   </div>}
 </AppFrame>;
}
