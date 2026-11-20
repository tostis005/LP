"use client";
import {useEffect} from "react";
import Link from "next/link";
import {AlertCircle,RotateCcw} from "lucide-react";

export default function CustomerError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{console.error("No se pudo mostrar la página de tarjetas",error);},[error]);
 return <main className="empty-page" role="alert">
  <AlertCircle size={32}/>
  <h1>No hemos podido mostrar tus tarjetas</h1>
  <p>Tus tarjetas y tus sellos siguen guardados. Puedes volver a intentarlo sin perder tus datos.</p>
  <button type="button" className="button button-dark" onClick={()=>reset()}>
   <RotateCcw size={17}/> Volver a intentar
  </button>
  <Link className="button button-outline" href="/acceder">Ir al acceso</Link>
 </main>;
}
