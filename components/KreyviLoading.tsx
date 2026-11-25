export function KreyviLoading({compact=false,label="Preparando tu espacio"}:{compact?:boolean;label?:string}){
 return <div className={"kreyvi-loading"+(compact?" compact":"")} role="status" aria-live="polite"><div className="kreyvi-loading-brand"><img src="/brand/kreyv-pegada-vino-mostaza-claro.svg" alt="Kreyvi" className="kreyvi-loading-wine"/><img src="/brand/kreyv-pegada-tinta-maiz-claro.svg" alt="Kreyvi" className="kreyvi-loading-ink"/></div><span className="kreyvi-loading-orbit" aria-hidden="true"/><span className="kreyvi-loading-label">{label}</span></div>;
}
