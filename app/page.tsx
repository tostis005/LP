import Link from "next/link";
import {ArrowUpRight, Gift, MapPin, WalletCards, Smartphone} from "lucide-react";
import {Brand} from "@/components/Brand";
import {StampCard} from "@/components/StampCard";
import "./customer-entry.css";
import {InstalledAppEntry} from "@/components/InstalledAppEntry";
// Public HTML must be generated for the current deployment, not a stale static root.
export const dynamic="force-dynamic";
export default function Home(){
 return <InstalledAppEntry><main className="customer-public">
  <header className="customer-public-nav"><Brand/><nav aria-label="Navegación principal"><Link href="/para-negocios">¿Eres negocio?</Link><Link href="/entrar" className="customer-public-login">Acceder <ArrowUpRight size={17}/></Link></nav></header>
  <section className="customer-public-hero"><div className="customer-public-copy"><span className="customer-public-kicker">CADA VISITA CUENTA</span><h1>Tus lugares favoritos.<br/><em>Tus próximos premios.</em></h1><p>Todas tus tarjetas de fidelización en un solo lugar. Suma sellos, descubre nuevos negocios y disfruta de las recompensas que mereces.</p><div className="customer-public-actions"><Link href="/entrar" className="customer-public-primary">Mis tarjetas <ArrowUpRight size={20}/></Link><Link href="/mi-loyally?instalar=1" className="customer-public-secondary"><Smartphone size={19}/> Instalar la app</Link></div><small>Gratis, sin tarjetas de papel y siempre contigo.</small></div>
  <div className="customer-public-art" aria-label="Ejemplo de tarjetas de fidelización"><div className="customer-public-card card-one"><StampCard name="Tu cafetería favorita" color="#70263b" reward="Tu próximo café gratis" total={8} earned={5} icon="coffee" stampColor="#fff" textColor="#fff"/></div><div className="customer-public-card card-two"><StampCard name="Tu heladería" color="#f0c46d" reward="Una bola de regalo" total={6} earned={2} stampColor="#652037" textColor="#652037"/></div><div className="customer-public-art-tag"><Gift size={20}/> Cada visita te acerca a un premio</div></div></section>
  <section className="customer-public-benefits" aria-label="Ventajas"><article><WalletCards/><h2>Todo en tu móvil</h2><p>No pierdas nunca más una tarjeta.</p></article><article><Gift/><h2>Premios de verdad</h2><p>Consulta tus sellos y recompensas.</p></article><article><MapPin/><h2>Descubre cerca de ti</h2><p>Encuentra nuevos lugares favoritos.</p></article></section>
  <footer className="customer-public-footer"><span>© {new Date().getFullYear()} Kreyvi</span><Link href="/para-negocios">Kreyvi para negocios</Link><Link href="/help">Ayuda y soporte</Link><Link href="/solicitar-acceso">Contacto</Link></footer>
 </main></InstalledAppEntry>;
}
