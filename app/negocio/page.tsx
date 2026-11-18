"use client";
import {AppFrame,type Account} from "@/components/AppFrame";
import BusinessWorkspace from "@/components/BusinessWorkspace";
export default function BusinessPage(){return <AppFrame area="business" title="Tu negocio, en buenas manos" subtitle="Personaliza tu programa, cuida a tus clientes y disfruta viéndolos volver.">{a=><BusinessWorkspace account={a}/>}</AppFrame>}
