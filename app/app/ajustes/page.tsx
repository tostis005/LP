"use client";
import Link from "next/link";
import {Settings2} from "lucide-react";
import {AppFrame} from "@/components/AppFrame";
import {CustomerNotificationSettings} from "@/components/CustomerNotificationSettings";
import {PushPreferences} from "@/components/PushPreferences";

export default function CustomerSettingsPage(){
 return <AppFrame area="customer" title="Ajustes" subtitle="Decide qué avisos recibes de cada una de tus tarjetas.">
  {account=><div className="customer-notification-settings">
   <div className="customer-settings-header"><Settings2 size={25}/><div><h2>Mis preferencias</h2><p>Personaliza tus avisos por negocio y mantén el control de tus datos.</p></div></div>
   <CustomerNotificationSettings account={account}/>
   <PushPreferences showBusinesses={false}/>
   <div className="panel-card customer-account-settings-link">
    <h2>Mi cuenta</h2><p className="muted">Actualiza tu nombre, correo o número de WhatsApp.</p>
    <Link href="/app/perfil" className="button button-outline">Editar mis datos</Link>
   </div>
  </div>}
 </AppFrame>;
}
