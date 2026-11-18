import Link from "next/link";
import { ArrowUpRight, ArrowRight, BadgeCheck, BarChart3, Check, ChevronRight, CircleDot, Gift, Heart, Layers3, MapPin, MousePointerClick, ScanLine, ShieldCheck, Smartphone, Sparkles, Star, Wallet, Zap } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { Brand } from "@/components/Brand";

const features = [
  { icon: <Wallet size={23}/>, title: "Una tarjeta que va contigo", text: "Tus clientes llevan sus tarjetas en el móvil, sin descargar ninguna app." },
  { icon: <Gift size={23}/>, title: "Recompensas a tu manera", text: "Sellos, puntos o cashback. Configura un programa que encaje con tu negocio." },
  { icon: <ScanLine size={23}/>, title: "Un escaneo y listo", text: "Tu equipo valida compras con su teléfono o un lector. Sin cambiar de caja." },
  { icon: <BarChart3 size={23}/>, title: "Entiende quién vuelve", text: "Mide visitas, clientes recurrentes, canjes y actividad en tiempo real." },
  { icon: <MapPin size={23}/>, title: "También te descubren", text: "Aparece en un directorio local para conectar con nuevos clientes cerca de ti." },
  { icon: <ShieldCheck size={23}/>, title: "Control en cada movimiento", text: "Permisos de empleados, límites antifraude e historial auditable." }
];
export default function Home() {
 return <div className="site"><PublicHeader/>
  <main>
   <section className="hero-section"><div className="container hero-grid">
    <div className="hero-copy">
      <div className="eyebrow"><span className="eyebrow-pulse"/> FIDELIZACIÓN HECHA FÁCIL</div>
      <h1>Que vuelvan.<br/><em>Una y otra vez.</em></h1>
      <p>Convierte una compra en una relación. Recompensa a tus clientes, crea conexiones reales y haz crecer tu negocio. Sin complicaciones.</p>
      <div className="hero-buttons"><Link href="/#contacto" className="button button-dark">Quiero empezar <ArrowUpRight size={19}/></Link><Link href="/demo" className="button button-outline">Explorar la demo <ArrowRight size={18}/></Link></div>
      <div className="hero-proof"><div className="avatar-stack"><i>A</i><i>M</i><i>J</i></div><span>Creado para los negocios<br/><strong>que dejan huella.</strong></span></div>
    </div>
    <div className="hero-visual">
      <div className="visual-orb orb-one"/><div className="visual-orb orb-two"/>
      <div className="visual-caption caption-top"><Sparkles size={17}/> Pequeños detalles, grandes relaciones</div>
      <div className="hero-card hero-card-back"><div className="decor-loop"/></div>
      <div className="hero-card hero-card-front">
        <div className="demo-card-head"><div className="demo-card-logo">n<span>·</span></div><span className="pill-light">MI TARJETA</span></div>
        <div className="demo-card-body"><small>Tu próximo café está cerca</small><strong>Un café más,<br/>una sonrisa más.</strong></div>
        <div className="stamp-row">{Array.from({length:8},(_,i)=><span className={i<6?"stamp earned":"stamp"} key={i}>{i<6?<Check size={18}/>:<CircleDot size={14}/>}</span>)}</div>
        <div className="demo-card-foot"><span>6 de 8 sellos</span><span>CAFÉ NOMA ↗</span></div>
      </div>
      <div className="floating-reward"><div className="floating-icon"><Gift size={21}/></div><div><strong>¡Recompensa conseguida!</strong><span>Otro motivo para volver ✨</span></div><BadgeCheck className="floating-check" size={20}/></div>
      <div className="visual-caption caption-bottom">Más clientes felices. Más veces. ♡</div>
    </div>
   </div></section>
   <section className="trust-ribbon"><div className="container ribbon-inner"><span>HECHO PARA LOCALES CON PERSONALIDAD</span><span><Star size={17}/> Cafeterías</span><span><Star size={17}/> Restaurantes</span><span><Star size={17}/> Barberías</span><span><Star size={17}/> Tiendas</span></div></section>
   <section className="section-pad" id="funcionalidades"><div className="container">
     <div className="section-heading"><div><div className="eyebrow">TODO EN UN MISMO LUGAR</div><h2>Toda la magia de<br/><em>hacer que vuelvan.</em></h2></div><p>Lo suficientemente potente para crecer. Lo suficientemente sencillo para usarlo cada día.</p></div>
     <div className="feature-grid">{features.map((f,i)=><article className={"feature-card feature-"+i} key={f.title}><div className="feature-icon">{f.icon}</div><h3>{f.title}</h3><p>{f.text}</p><span className="feature-index">0{i+1}</span></article>)}</div>
   </div></section>
   <section className="how-section" id="como-funciona"><div className="container how-grid">
    <div className="how-illustration"><div className="how-blob"/><div className="how-phone"><div className="phone-notch"/><div className="phone-top">09:41 <span>●●●</span></div><small>Tus tarjetas</small><h3>Hola, Martina 👋</h3><p>Tus sitios favoritos, en un lugar.</p><div className="mini-business-card">☕ <div><b>Café Noma</b><small>6 / 8 sellos</small></div><ChevronRight size={16}/></div><div className="mini-business-card lilac">✂️ <div><b>Studio Norte</b><small>80 puntos</small></div><ChevronRight size={16}/></div><div className="phone-bottom">Inicio <span>Descubrir</span> Perfil</div></div><div className="how-note"><Heart size={20} fill="currentColor"/> Fácil para ti. Genial para ellos.</div></div>
    <div className="how-copy"><div className="eyebrow">ASÍ DE SIMPLE</div><h2>La fidelidad<br/>no debería ser<br/><em>complicada.</em></h2>
     <div className="step"><span>01</span><div><h3>Crea tu programa</h3><p>Personaliza tu tarjeta, elige cómo recompensar y listo. Todo a tu estilo.</p></div></div>
     <div className="step"><span>02</span><div><h3>Comparte tu tarjeta</h3><p>Un código QR es todo lo que necesitan tus clientes para unirse.</p></div></div>
     <div className="step"><span>03</span><div><h3>Haz que quieran volver</h3><p>Tu equipo valida cada compra. Tú sigues los resultados desde un panel precioso.</p></div></div>
     <Link href="/demo" className="text-link">Conoce la experiencia <ArrowUpRight size={18}/></Link>
    </div>
   </div></section>
   <section className="mid-cta"><div className="container"><div className="mid-cta-inner"><div><div className="eyebrow">CRECE SIN COMPLICARTE</div><h2>Tu negocio merece<br/><em>clientes que regresen.</em></h2><p>Más cerca de tus clientes. Más control de tu negocio. Menos herramientas sueltas.</p><Link href="/precios" className="button button-cream">Descubre nuestros planes <ArrowUpRight size={18}/></Link></div><div className="cta-star"><Sparkles size={90} strokeWidth={1}/></div></div></div></section>
   <section className="section-pad pricing-preview"><div className="container"><div className="section-heading"><div><div className="eyebrow">PRECIOS SIN SORPRESAS</div><h2>Potente por dentro.<br/><em>Ligero en tu bolsillo.</em></h2></div><p>Sin hardware, sin letras pequeñas. Empieza con lo esencial y crece a tu ritmo.</p></div><div className="pricing-strip"><div><span>PLAN BUSINESS</span><strong>19,90 € <small>/mes</small></strong><p>Tarjetas, programas de fidelización, clientes, analítica y equipo.</p></div><Link href="/precios" className="button button-dark">Ver todos los detalles <ArrowUpRight size={17}/></Link></div></div></section>
   <section className="contact-section" id="contacto"><div className="container contact-grid"><div><div className="eyebrow">¿HABLAMOS?</div><h2>Tu próxima gran<br/>idea empieza <em>aquí.</em></h2><p>Estamos preparando el lanzamiento. Explora el producto y contacta cuando quieras para conocer las opciones.</p></div><div className="contact-actions"><Link href="/demo" className="button button-dark">Ver la demo <ArrowUpRight size={18}/></Link><Link href="/acceder" className="button button-outline">Acceder a mi cuenta</Link></div></div></section>
  </main>
  <footer className="footer"><div className="container footer-main"><div><Brand/><p>Pequeñas recompensas.<br/>Grandes relaciones.</p></div><div className="footer-links"><Link href="/precios">Precios</Link><Link href="/demo">Demo</Link><Link href="/acceder">Acceder</Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Loyally. Hecho para volver.</span><span>Más cerca, cada día. ♡</span></div></footer>
 </div>;
}
