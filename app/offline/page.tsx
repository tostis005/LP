import Link from "next/link";
export default function Offline(){
 return <main style={{minHeight:"100dvh",display:"grid",placeContent:"center",padding:32,textAlign:"center",background:"#f9f4f6",color:"#571c32"}}>
 <h1>Ahora mismo no hay conexión</h1>
 <p>Tus tarjetas y canjes se verifican de forma segura cuando vuelves a estar en línea.</p>
 <Link href="/app" style={{background:"#571c32",color:"#fff",padding:14,borderRadius:14}}>Reintentar</Link>
 </main>
}
