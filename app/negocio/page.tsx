"use client";
import {AppFrame,type Account} from "@/components/AppFrame";
import BusinessWorkspace from "@/components/BusinessWorkspace";
export default function BusinessPage(){return <AppFrame area="business" title="Mi negocio" subtitle="">{a=><BusinessWorkspace account={a}/>}</AppFrame>}
