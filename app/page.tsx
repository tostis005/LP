import Link from "next/link";
import {
 ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, Check, Coffee, Gift,
 Heart, Menu, Palette, QrCode, ScanLine, Scissors, ShieldCheck, Smartphone,
 Sparkles, Store, Ticket, Users, UtensilsCrossed
} from "lucide-react";
import {PublicHeader} from "@/components/PublicHeader";
import {Brand} from "@/components/Brand";
import {StampCard} from "@/components/StampCard";
import {StampMark} from "@/components/StampMarks";
import "./landing.css";

const features=[
 {icon:<Palette size={23}/>,title:"Cada negocio, su propia tarjeta",text:"Colores, recompensa, logotipo y sellos que reflejan la personalidad de tu marca."},
 {icon:<QrCode size={23}/>,title:"Todo empieza con un QR",text:"El cliente se une desde el móvil. En sus próximas visitas, el personal valida los sellos."},
 {icon:<BarChart3 size={23}/>,title:"Entiende las visitas",text:"Consulta clientes, recompensas canjeadas y actividad de tu programa desde un único panel."},
 {icon:<ShieldCheck size={23}/>,title:"Un equipo, permisos claros",text:"El dueño administra el negocio y el personal puede asignar o canjear sellos con su propia cuenta."}
];
const steps=[
 {num:"01",title:"Diseña tu programa",text:"Elige el premio, cuántos sellos necesita el cliente y qué icono aparecerá en su tarjeta."},
 {num:"02",title:"Comparte tu QR",text:"Colócalo en el mostrador o en la mesa. El cliente se registra y guarda su tarjeta digital."},
 {num:"03",title:"Premia cada regreso",text:"El empleado escanea el QR personal del cliente, añade los sellos y valida las recompensas."}
];
const roles=[
 {icon:<ShieldCheck size={24}/>,number:"01",name:"Administrador",text:"Visión global de negocios, usuarios e informes."},
 {icon:<Store size={24}/>,number:"02",name:"Dueño del negocio",text:"Configura la tarjeta y consulta su actividad."},
 {icon:<ScanLine size={24}/>,number:"03",name:"Personal de atención",text:"Escanea tarjetas y registra sellos en segundos."},
 {icon:<Heart size={24}/>,number:"04",name:"Cliente",text:"Lleva sus sellos y premios en el teléfono."}
];
export default function Home(){
 return <div className="loi-site">
  <PublicHeader/>
  <main>
   <section className="loi-hero" id="inicio">
    <div className="container loi-hero-layout">
     <div className="loi-hero-copy">
      <span className="loi-overline"><span className="loi-status-dot"/> LA FIDELIZACIÓN, COMO DEBERÍA SER</span>
      <h1>Haz que cada visita <em>invite a volver.</em></h1>
      <p>LoiaG transforma las tarjetas de sellos de toda la vida en una experiencia digital sencilla, bonita y hecha para los negocios de barrio.</p>
      <div className="loi-hero-actions">
       <Link href="/acceder" className="loi-button loi-button-main">Acceder <ArrowUpRight size={19}/></Link>
       <Link href="/#como-funciona" className="loi-button loi-button-light">Descubre cómo funciona <ArrowRight size={18}/></Link>
      </div>
      <div className="loi-hero-foot"><div className="loi-hero-foot-icons"><span><QrCode size={17}/></span><span><Smartphone size={17}/></span><span><Gift size={17}/></span></div><span>Un QR. Una tarjeta digital.<br/><strong>Muchos motivos para regresar.</strong></span></div>
     </div>
     <div className="loi-hero-showcase" aria-label="Ejemplo ilustrativo de la tarjeta digital de fidelización">
      <div className="loi-hero-orbit orbit-a"/><div className="loi-hero-orbit orbit-b"/>
      <div className="loi-showcase-caption"><Sparkles size={17}/> Tu marca, sus recompensas.</div>
      <div className="loi-showcase-phone">
       <div className="loi-phone-status"><span>9:41</span><span>●●●</span></div>
       <div className="loi-phone-heading"><span>Mi tarjeta</span><span className="loi-phone-mini-icon"><Heart size={17}/></span></div>
       <div className="loi-phone-greeting">Hola, Martina <span>✳</span></div>
       <p>Tu próxima recompensa está más cerca.</p>
       <StampCard name="Café Noma" color="#23503b" reward="Tu próximo café gratis" total={8} earned={5} icon="coffee" message="SIEMPRE ES UN BUEN DÍA"/>
       <div className="loi-phone-progress"><span><Gift size={17}/> ¡Ya queda poco!</span><strong>3 sellos para tu premio</strong></div>
       <div className="loi-phone-nav"><span className="active"><Ticket size={17}/> Tarjetas</span><span><Store size={17}/> Negocios</span><span><Users size={17}/> Perfil</span></div>
      </div>
      <div className="loi-showcase-floating"><span className="loi-floating-icon"><BadgeCheck size={23}/></span><div><strong>Una visita que cuenta</strong><small>+1 sello en tu tarjeta</small></div></div>
      <span className="loi-demo-disclaimer">VISTA ILUSTRATIVA · DATOS FICTICIOS</span>
     </div>
    </div>
   </section>
   <div className="loi-audience-strip"><div className="container"><span>HECHO PARA LUGARES CON PERSONALIDAD</span><span><Coffee size={19}/> Cafeterías</span><span><UtensilsCrossed size={19}/> Restaurantes</span><span><Scissors size={19}/> Barberías</span><span><Store size={19}/> Comercios locales</span></div></div>

   <section className="loi-section" id="funcionalidades">
    <div className="container">
     <div className="loi-section-lead"><div><span className="loi-overline">TODO LO QUE NECESITAS</span><h2>Lo sencillo enamora.<br/><em>Lo útil hace volver.</em></h2></div><p>La experiencia que espera el cliente, con las herramientas que necesita quien está al frente de un negocio.</p></div>
     <div className="loi-feature-grid">{features.map((f,i)=><article className="loi-feature" key={f.title}><div className="loi-feature-icon">{f.icon}</div><span className="loi-feature-index">0{i+1}</span><h3>{f.title}</h3><p>{f.text}</p></article>)}</div>
    </div>
   </section>

   <section className="loi-process" id="como-funciona">
    <div className="container loi-process-layout">
     <div className="loi-process-copy"><span className="loi-overline">EN TRES PASOS</span><h2>Tu próximo cliente fiel empieza <em>con un escaneo.</em></h2><p>Sin tarjetas de papel que se pierden. Sin pedirle al cliente que descargue una aplicación distinta por cada local.</p><Link href="/acceder" className="loi-text-link">Explorar los cuatro perfiles <ArrowUpRight size={18}/></Link></div>
     <div className="loi-process-steps">{steps.map(s=><article className="loi-step" key={s.num}><span>{s.num}</span><div><h3>{s.title}</h3><p>{s.text}</p></div><Check size={19}/></article>)}</div>
    </div>
   </section>

   <section className="loi-design-section" id="personalizacion">
    <div className="container loi-design-layout">
     <div className="loi-design-preview">
      <div className="loi-design-preview-label"><span className="loi-status-dot"/> TU TARJETA, TUS REGLAS</div>
      <StampCard name="Casa Buena" color="#7452a3" reward="Un almuerzo de regalo" total={6} earned={4} icon="burger" message="GRACIAS POR VOLVER"/>
      <div className="loi-stamp-library"><span>ALGUNOS DE TUS SELLOS</span><div>{["coffee","burger","beard","hair","star","gift"].map(kind=><span key={kind}><StampMark kind={kind} size={25}/></span>)}</div></div>
     </div>
     <div className="loi-design-copy"><span className="loi-overline">UN PROGRAMA QUE ES TUYO</span><h2>Tu estilo. <em>Tu comunidad.</em></h2><p>¿Café, hamburguesa o un corte de pelo? Personaliza cada sello con una biblioteca de ilustraciones o sube tu propia imagen. Elige los colores, el premio y el número de visitas.</p>
      <div className="loi-design-points"><div><Check size={17}/> Sellos con ilustraciones SVG o imagen propia</div><div><Check size={17}/> Huecos y progreso visibles al instante</div><div><Check size={17}/> Código QR individual por cliente</div></div>
      <Link href="/acceder" className="loi-button loi-button-main">Probar el configurador <ArrowUpRight size={18}/></Link>
     </div>
    </div>
   </section>

   <section className="loi-section loi-roles-section" id="para-quien">
    <div className="container">
     <div className="loi-section-lead"><div><span className="loi-overline">UNA PLATAFORMA. CUATRO EXPERIENCIAS.</span><h2>Todo el mundo sabe <em>dónde tocar.</em></h2></div><p>Pensado para un móvil en la mano, una tablet en el mostrador y un panel cómodo para gestionar el negocio.</p></div>
     <div className="loi-role-grid">{roles.map(role=><article className="loi-role-card" key={role.name}><div className="loi-role-top"><span>{role.icon}</span><small>{role.number}</small></div><h3>{role.name}</h3><p>{role.text}</p></article>)}</div>
     <div className="loi-role-action"><span><Smartphone size={18}/> Adaptado a móvil, tablet y escritorio</span><Link href="/acceder" className="loi-text-link">Entrar y elegir perfil <ArrowRight size={18}/></Link></div>
    </div>
   </section>

   <section className="loi-final-section" id="empezar"><div className="container"><div className="loi-final-card"><div><span className="loi-overline">PEQUEÑOS NEGOCIOS, GRANDES RELACIONES</span><h2>Que te recuerden.<br/><em>Que quieran volver.</em></h2><p>Conoce LoiaG desde dentro y descubre cómo sería un programa de fidelización propio para tu negocio.</p><div className="loi-final-actions"><Link href="/acceder" className="loi-button loi-button-cream">Acceder a LoiaG <ArrowUpRight size={19}/></Link><Link href="/solicitar-acceso" className="loi-final-secondary">Solicitar información <ArrowRight size={17}/></Link></div></div><div className="loi-final-deco" aria-hidden="true"><Heart size={170} strokeWidth={.8}/><Sparkles size={58} strokeWidth={1.3}/></div></div></div></section>
  </main>
  <footer className="loi-footer"><div className="container loi-footer-top"><div><Brand/><p>Pequeños gestos. Grandes relaciones.<br/>La fidelización que se siente cercana.</p></div><nav aria-label="Enlaces de pie de página"><Link href="/#funcionalidades">Funcionalidades</Link><Link href="/#como-funciona">Cómo funciona</Link><Link href="/solicitar-acceso">Contacto</Link><Link href="/acceder">Acceder</Link></nav></div><div className="container loi-footer-bottom"><span>© {new Date().getFullYear()} LoiaG · Nombre provisional</span><span>Hecho para negocios que dejan huella. ♡</span></div></footer>
 </div>;
}
