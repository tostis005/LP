export function KreyviLoading({compact=false,label="Cargando Kreyvi"}:{compact?:boolean;label?:string}){
 return <div className={"kreyvi-loading"+(compact?" compact":"")} role="status" aria-label={label}><div className="kreyvi-loading-brand" aria-hidden="true"><img src="/brand/kreyv-pegada-vino-mostaza-claro.svg" alt="" className="kreyvi-loading-wine"/><img src="/brand/kreyv-pegada-tinta-maiz-claro.svg" alt="" className="kreyvi-loading-ink"/></div></div>;
}
