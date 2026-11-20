"use client";
import {AppFrame} from "@/components/AppFrame";
import BusinessWorkspace from "@/components/BusinessWorkspace";
export default function BusinessSectionPage(){
 return <AppFrame area="business" title="Mi negocio" subtitle="">
  {a=><BusinessWorkspace account={a}/>}
 </AppFrame>;
}
