import {KreyviLoading} from "./KreyviLoading";
import {AlertCircle,RefreshCw,MapPinned} from "lucide-react";
import "@/app/crm-polish.css";
export function CrmLoading({title,description,kind="directory"}:{title:string;description:string;kind?:"directory"|"map"}){
 return <div className={"crm-loading-state crm-loading-"+kind} aria-busy="true"><KreyviLoading compact label={title}/><strong>{title}</strong><p>{description}</p></div>;
}
export function CrmLoadError({title,message,onRetry,kind="directory"}:{title:string;message:string;onRetry:()=>void;kind?:"directory"|"map"}){
 return <div className={"crm-loading-state crm-loading-"+kind}><AlertCircle size={30} className="crm-state-icon"/><strong>{title}</strong><p role="alert">{message}</p><button type="button" className="button button-outline button-sm" onClick={onRetry}><RefreshCw size={16}/> Reintentar</button></div>;
}
export function CrmMapFrame({children,summary,loading=false}:{children:React.ReactNode;summary:string;loading?:boolean}){
 return <section className="crm-map-frame" aria-label="Mapa de negocios" aria-busy={loading}><header className="crm-map-heading"><div className="crm-map-heading-icon"><MapPinned size={22}/></div><div><h3>Mapa de negocios</h3><p>{summary}</p></div><span className="crm-map-legend"><i/> Negocio</span></header><div className="crm-map-viewport">{children}</div></section>;
}
export function CrmMapLoading(){
 return <CrmMapFrame summary="Preparando la vista geográfica" loading><CrmLoading kind="map" title="Cargando mapa" description="Estamos preparando las ubicaciones de los negocios que coinciden con tus filtros."/></CrmMapFrame>;
}
