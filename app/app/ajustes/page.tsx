"use client";
import {BellRing} from "lucide-react";
import {AppFrame} from "@/components/AppFrame";
import {CustomerNotificationSettings} from "@/components/CustomerNotificationSettings";
import {PushPreferences} from "@/components/PushPreferences";
export default function CustomerSettingsPage(){
 return <AppFrame area="customer" title="Ajustes" subtitle="Tus notificaciones, a tu manera.">
  {account=><div className="customer-notification-settings">
   <div className="customer-settings-header"><BellRing size={25}/><div><h2>Notificaciones</h2><p>Elige cómo recibir los avisos de tus tarjetas.</p></div></div>
   <CustomerNotificationSettings account={account}/>
   <PushPreferences showBusinesses={false}/>
  </div>}
 </AppFrame>;
}
