import Link from "next/link";
import {ArrowRight,ArrowUpRight,Check,Download} from "lucide-react";
import {PublicHeader} from "@/components/PublicHeader";
import {InstallGuide} from "@/components/InstallGuide";
import {Brand} from "@/components/Brand";
import {StampCard} from "@/components/StampCard";
import {StampMark} from "@/components/StampMarks";
import {KreyvIcon} from "@/components/KreyvIcon";
import {LANDING_COPY,landingHref,type LandingLanguage} from "@/lib/landing-copy";

const BENEFIT_ICONS=["favoritos","premios","comercio","perfil"] as const;

export function LandingHome({lang="es"}:{lang?:LandingLanguage}){
 const t=LANDING_COPY[lang];
 return <div className="loi-site">
  <PublicHeader lang={lang}/>
  <main>
   <section className="loi-hero" id="inicio">
    <div className="container loi-hero-layout">
     <div className="loi-hero-copy">
      <span className="loi-overline">{t.hero.eyebrow}</span>
      <h1>{t.hero.title} <em>{t.hero.accent}</em></h1>
      <p>{t.hero.description}</p>
      <div className="loi-hero-actions">
       <Link href="/solicitar-acceso" className="loi-button loi-button-main">{t.hero.primary} <ArrowUpRight size={19}/></Link>
       <Link href={landingHref(lang,"como-funciona")} className="loi-button loi-button-light">{t.hero.secondary} <ArrowRight size={18}/></Link>
       <Link href={landingHref(lang,"instalar")} className="loi-button loi-button-install"><Download size={18}/>{lang==="en"?"Kreyv on my phone":"Kreyv en mi móvil"}</Link>
      </div>
      <div className="loi-hero-foot"><div className="loi-hero-foot-icons"><span><KreyvIcon name="favoritos" size={17}/></span><span><KreyvIcon name="cafeteria" size={17}/></span><span><KreyvIcon name="premios" size={17}/></span></div><span>{t.hero.foot}<br/><strong>{t.hero.footBold}</strong></span></div>
     </div>
     <div className="loi-hero-showcase" aria-label={t.hero.previewLabel}>
      <div className="loi-hero-orbit orbit-a"/><div className="loi-hero-orbit orbit-b"/>
      <div className="loi-showcase-caption"><KreyvIcon name="recompensa" size={17}/> {t.hero.previewLabel}</div>
      <div className="loi-showcase-phone">
       <div className="loi-phone-status"><span>9:41</span><span>●●●</span></div>
       <div className="loi-phone-heading"><span>{t.hero.myCard}</span><span className="loi-phone-mini-icon"><KreyvIcon name="favoritos" size={17}/></span></div>
       <div className="loi-phone-greeting">{t.hero.hello} <span aria-hidden="true"><KreyvIcon name="recompensa" size={19}/></span></div>
       <p>{t.hero.nearReward}</p>
       <StampCard locale={lang} name="Tu cafetería" color="#5E1A2B" stampColor="#D9A23A" reward={t.hero.reward} total={8} earned={5} icon="coffee" message={t.hero.cardMessage}/>
       <div className="loi-phone-progress"><span><KreyvIcon name="premios" size={17}/> {t.hero.almost}</span><strong>{t.hero.progress}</strong></div>
       <div className="loi-phone-nav"><span className="active"><KreyvIcon name="mis-tarjetas" size={17}/> {t.hero.cardNav}</span><span><KreyvIcon name="comercio" size={17}/> {t.hero.businessNav}</span><span><KreyvIcon name="perfil" size={17}/> {t.hero.profileNav}</span></div>
      </div>
      <div className="loi-showcase-floating"><span className="loi-floating-icon"><KreyvIcon name="recompensa" size={23}/></span><div><strong>{t.hero.floatingTitle}</strong><small>{t.hero.floatingDetail}</small></div></div>
      
     </div>
    </div>
   </section>
   <section className="loi-audience-strip loi-audience-expanded" aria-labelledby="loi-audience-heading"><div className="container loi-audience-expanded-inner"><div className="loi-audience-title"><span className="loi-overline">{t.audience.eyebrow}</span><h2 id="loi-audience-heading">{lang==="en"?"For any business that wants loyal customers.":"Para cualquier negocio que quiera clientes que vuelvan."}</h2><p>{lang==="en"?"From neighborhood favorites to growing chains, Kreyv adapts to your business.":"Desde un pequeño establecimiento hasta una cadena de locales: Kreyv se adapta a ti."}</p></div><div className="loi-audience-list"><span><StampMark kind="cafeteria" size={24}/>{lang==="en"?"Coffee shops":"Cafeterías"}</span><span><StampMark kind="restaurante" size={24}/>{lang==="en"?"Restaurants":"Restaurantes"}</span><span><StampMark kind="barberia" size={24}/>{lang==="en"?"Barbershops":"Barberías"}</span><span><StampMark kind="peluqueria" size={24}/>{lang==="en"?"Hair salons":"Peluquerías"}</span><span><StampMark kind="panaderia" size={24}/>{lang==="en"?"Bakeries":"Panaderías"}</span><span><StampMark kind="gimnasio" size={24}/>{lang==="en"?"Gyms":"Gimnasios"}</span><span><StampMark kind="mascotas" size={24}/>{lang==="en"?"Pet services":"Mascotas"}</span><span><StampMark kind="floristeria" size={24}/>{lang==="en"?"Flower shops":"Floristerías"}</span><span><StampMark kind="comercio" size={24}/>{lang==="en"?"Retail shops":"Comercios"}</span><span><StampMark kind="spa" size={24}/>{lang==="en"?"Spas":"Spa y bienestar"}</span><span><StampMark kind="comercio" size={24}/>{lang==="en"?"Auto services":"Automoción"}</span><span><StampMark kind="libreria" size={24}/>{lang==="en"?"And more":"Y muchos más"}</span></div></div></section>

   <InstallGuide lang={lang}/>

   <section className="loi-section" id="beneficios">
    <div className="container">
     <div className="loi-section-lead"><div><span className="loi-overline">{t.benefits.eyebrow}</span><h2>{t.benefits.first}<br/><em>{t.benefits.second}</em></h2></div><p>{t.benefits.intro}</p></div>
     <div className="loi-feature-grid">{t.benefits.items.map((f,i)=>{const Icon=BENEFIT_ICONS[i];return <article className="loi-feature" key={f.title}><div className="loi-feature-icon"><KreyvIcon name={Icon} size={23}/></div><span className="loi-feature-index">0{i+1}</span><h3>{f.title}</h3><p>{f.text}</p></article>})}</div>
    </div>
   </section>

   <section className="loi-process" id="como-funciona">
    <div className="container loi-process-layout">
     <div className="loi-process-copy"><span className="loi-overline">{t.how.eyebrow}</span><h2>{t.how.first} <em>{t.how.second}</em></h2><p>{t.how.intro}</p><Link href="/solicitar-acceso" className="loi-text-link">{t.how.cta} <ArrowUpRight size={18}/></Link></div>
     <div className="loi-process-steps">{t.how.items.map((s,i)=><article className="loi-step" key={s.title}><span>0{i+1}</span><div><h3>{s.title}</h3><p>{s.text}</p></div><Check size={19}/></article>)}</div>
    </div>
   </section>

   <section className="loi-design-section" id="personalizacion">
    <div className="container loi-design-layout">
     <div className="loi-design-preview">
      <div className="loi-design-preview-label">{t.design.previewLabel}</div>
      <StampCard locale={lang} name="Casa Buena" color="#8A3346" stampColor="#EBC77F" reward={t.design.illustrationReward} total={6} earned={4} icon="burger" message={t.design.illustrationMessage}/>
      <div className="loi-stamp-library"><span>{t.design.iconsLabel}</span><div>{["cafeteria","hamburgueseria","restaurante","barberia","peluqueria","pizzeria","panaderia","taqueria","gimnasio","mascotas","floristeria","spa"].map(kind=><span key={kind}><StampMark kind={kind} size={25} color="#5E1A2B"/></span>)}</div></div>
     </div>
     <div className="loi-design-copy"><span className="loi-overline">{t.design.eyebrow}</span><h2>{t.design.first} <em>{t.design.second}</em></h2><p>{t.design.description}</p>
      <div className="loi-design-points">{t.design.points.map(point=><div key={point}><Check size={17}/> {point}</div>)}</div>
      <Link href="/solicitar-acceso" className="loi-button loi-button-main">{t.design.cta} <ArrowUpRight size={18}/></Link>
     </div>
    </div>
   </section>

   <section className="loi-final-section" id="empezar"><div className="container"><div className="loi-final-card"><div><span className="loi-overline">{t.final.eyebrow}</span><h2>{t.final.first}<br/><em>{t.final.second}</em></h2><p>{t.final.description}</p><div className="loi-final-actions"><Link href="/solicitar-acceso" className="loi-button loi-button-cream">{t.final.primary} <ArrowUpRight size={19}/></Link><Link href="/acceder" className="loi-final-secondary">{t.final.secondary} <ArrowRight size={17}/></Link></div></div><div className="loi-final-deco" aria-hidden="true"><KreyvIcon name="premios" size={170}/><KreyvIcon name="recompensa" size={58}/></div></div></div></section>
  </main>
  <footer className="loi-footer"><div className="container loi-footer-top"><div><Brand href={landingHref(lang)}/><p>{t.footer.tagline}<br/>{t.footer.description}</p></div><nav aria-label={lang==="en"?"Footer links":"Enlaces del pie de página"}><Link href={landingHref(lang,"beneficios")}>{t.footer.benefits}</Link><Link href={landingHref(lang,"como-funciona")}>{t.footer.how}</Link><Link href="/solicitar-acceso">{t.footer.contact}</Link><Link href="/acceder">{t.footer.access}</Link><Link href={landingHref(lang,"instalar")}>{lang==="en"?"The app":"La app"}</Link></nav></div><div className="container loi-footer-bottom"><span>© {new Date().getFullYear()} Kreyv</span><span>{t.footer.goodbye}</span></div></footer>
 </div>;
}
