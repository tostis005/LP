import Link from "next/link";
export default function Offline(){
 return <main style={{minHeight:"100dvh",display:"grid",placeContent:"center",padding:32,textAlign:"center",background:"var(--color-bg)",color:"var(--color-brand)"}}>
 <h1>Ahora mismo no hay conexión</h1>
 <p>Tus tarjetas y canjes se verifican de forma segura cuando vuelves a estar en línea.</p>
 <Link href="/app" style={{background:"var(--color-brand)",color:"#fff",padding:14,borderRadius:14}}>Reintentar</Link>
 </main>
}
