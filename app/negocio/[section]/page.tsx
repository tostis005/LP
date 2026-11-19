"use client";
import {AppFrame} from "@/components/AppFrame";
import BusinessWorkspace from "@/components/BusinessWorkspace";
export default function BusinessSectionPage(){
 return <AppFrame area="business" title="Tu negocio, en buenas manos" subtitle="Todo tu negocio, con un único menú y cada cosa en su lugar.">
  {a=><BusinessWorkspace account={a}/>}
 </AppFrame>;
}
