import {PUBLIC_BUSINESS_SECTORS} from "@/lib/public-business-sectors";
import Link from "next/link";
import {ArrowRight,ArrowUpRight,Check,Download} from "lucide-react";
import {PublicHeader} from "@/components/PublicHeader";
import {PublicFooter} from "@/components/PublicFooter";
import {InstallGuide} from "@/components/InstallGuide";
import {Brand} from "@/components/Brand";
import {BrandText} from "@/components/BrandText";
import {StampCard} from "@/components/StampCard";
import {StampMark} from "@/components/StampMarks";
import {KreyvIcon} from "@/components/KreyvIcon";
import {LANDING_COPY,landingHref,type LandingLanguage} from "@/lib/landing-copy";

const BENEFIT_ICONS=["premios","comercio","perfil","favoritos"] as const;

export function LandingHome({lang="es"}:{lang?:LandingLanguage}){
 const t=LANDING_COPY[lang];
 return <div className="loi-site">
  <PublicHeader lang={lang}/>
  <main>
   <section className="loi-hero" id="inicio">
    <div className="container loi-hero-layout">
     <div className="loi-hero-copy">
      <span className="loi-overline">{t.hero.eyebrow}</span>
      <h1>{t.hero.title} <em>{t.hero.accent}<svg className="loi-hero-underline" viewBox="0 0 300 16" fill="none" aria-hidden="true" preserveAspectRatio="none"><path d="M3 12 Q145 -3 297 8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/></svg></em></h1>
      <p>{t.hero.description}</p>
      <div className="loi-hero-actions">
       <Link href="/solicitar-acceso" className="loi-button loi-button-main">{t.hero.primary} <ArrowUpRight size={19}/></Link>
       <Link href={landingHref(lang,"como-funciona")} className="loi-button loi-button-light">{t.hero.secondary} <ArrowRight size={18}/></Link>
       <a href="/mi-loyally?instalar=1" className="loi-button loi-button-install"><Download size={18}/><BrandText value={lang==="en"?"Kreyvi on my phone":"Kreyvi en mi móvil"}/></a>
      </div>
      <div className="loi-hero-foot"><div className="loi-hero-foot-icons"><span><KreyvIcon name="favoritos" size={17}/></span><span><KreyvIcon name="cafeteria" size={17}/></span><span><KreyvIcon name="premios" size={17}/></span></div><span>{t.hero.foot}<br/><strong>{t.hero.footBold}</strong></span></div>
     </div>
     <div className="loi-hero-showcase" aria-label={t.hero.previewLabel}>
      <div className="loi-hero-orbit orbit-a" aria-hidden="true"/><div className="loi-hero-orbit orbit-b" aria-hidden="true"/>
      <div className="loi-showcase-caption">{t.hero.previewLabel}</div>
      <div className="loi-showcase-phone">
       <div className="loi-phone-status"><span>9:41</span><span>●●●</span></div>
       <div className="loi-phone-heading"><span>{t.hero.myCard}</span><span className="loi-phone-mini-icon"><KreyvIcon name="favoritos" size={17}/></span></div>
       <div className="loi-phone-greeting">{t.hero.hello} <span aria-hidden="true"><KreyvIcon name="recompensa" size={19}/></span></div>
       <p>{t.hero.nearReward}</p>
       <div className="loi-marketing-card loi-marketing-card-wine"><StampCard locale={lang} name="Tu cafetería" color="#5E1A2B" stampColor="#5E1A2B" reward={t.hero.reward} total={8} earned={5} icon="coffee" message={t.hero.cardMessage}/></div>
       <div className="loi-phone-progress"><span><KreyvIcon name="premios" size={17}/> {t.hero.almost}</span><strong>{t.hero.progress}</strong></div>
       <div className="loi-phone-nav"><span className="active"><KreyvIcon name="mis-tarjetas" size={17}/> {t.hero.cardNav}</span><span><KreyvIcon name="comercio" size={17}/> {t.hero.businessNav}</span><span><KreyvIcon name="perfil" size={17}/> {t.hero.profileNav}</span></div>
      </div>
      <div className="loi-hero-callouts">
       <div className="loi-hero-callout loi-hero-callout-discover"><span className="loi-floating-icon"><KreyvIcon name="comercio" size={22}/></span><div><strong>{lang==="en"?"Discover local":"Descubre cerca de ti"}</strong><small>{lang==="en"?"More ways to find your business":"Más visibilidad para tu negocio"}</small></div></div>
       <div className="loi-hero-callout loi-hero-callout-reward"><span className="loi-floating-icon"><KreyvIcon name="premios" size={22}/></span><div><strong>{lang==="en"?"Reasons to return":"Motivos para volver"}</strong><small>{lang==="en"?"Every visit counts":"Cada visita cuenta"}</small></div></div>
      </div>
      
     </div>
    </div>
   </section>
   <section className="loi-audience-strip loi-audience-expanded" aria-labelledby="loi-audience-heading"><div className="container loi-audience-expanded-inner"><div className="loi-audience-title"><span className="loi-overline">{t.audience.eyebrow}</span><h2 id="loi-audience-heading">{lang==="en"?"For any business that wants loyal customers.":"Para cualquier negocio que quiera clientes que vuelvan."}</h2><p><BrandText value={lang==="en"?"From neighborhood favorites to growing chains, Kreyvi adapts to your business.":"Desde un pequeño establecimiento hasta una cadena de locales: Kreyvi se adapta a ti."}/></p></div><div className="loi-audience-list">{PUBLIC_BUSINESS_SECTORS.map(sector=><span key={sector.value}><StampMark kind={sector.icon} size={24}/>{sector[lang]}</span>)}</div></div></section>

   <section className="loi-section" id="beneficios">
    <div className="container">
     <div className="loi-section-lead"><div><span className="loi-overline">{t.benefits.eyebrow}</span><h2>{t.benefits.first}<br/><em><BrandText value={t.benefits.second}/></em></h2></div><p>{t.benefits.intro}</p></div>
     <div className="loi-feature-grid">{t.benefits.items.map((f,i)=>{const Icon=BENEFIT_ICONS[i];return <article className="loi-feature" key={f.title}><div className="loi-feature-icon"><KreyvIcon name={Icon} size={23}/></div><span className="loi-feature-index">0{i+1}</span><h3>{f.title}</h3><p>{f.text}</p></article>})}</div>
    </div>
   </section>

   <section className="loi-process" id="como-funciona">
    <div className="container loi-process-layout">
     <div className="loi-process-copy"><span className="loi-overline">{t.how.eyebrow}</span><h2>{t.how.first} <em>{t.how.second}</em></h2><p>{t.how.intro}</p><Link href="/solicitar-acceso" className="loi-text-link">{t.how.cta} <ArrowUpRight size={18}/></Link></div>
     <div className="loi-process-steps">{t.how.items.map((s,i)=><article className="loi-step" key={s.title}><span>0{i+1}</span><div><h3>{s.title}</h3><p>{s.text}</p></div><Check size={19}/></article>)}</div>
    </div>
   </section>

   <section className="loi-section" id="comunidad">
    <div className="container loi-process-layout">
     <div className="loi-design-copy"><span className="loi-overline">{t.community.eyebrow}</span><h2>{t.community.first} <em>{t.community.second}</em></h2><p>{t.community.intro}</p><Link href="/solicitar-acceso" className="loi-button loi-button-main">{lang==="en"?"Join the community":"Únete a la comunidad"} <ArrowUpRight size={18}/></Link></div>
     <div className="loi-process-steps">{t.community.items.map((item,i)=><article className="loi-step" key={item.title}><span><KreyvIcon name={BENEFIT_ICONS[i]} size={25}/></span><div><h3>{item.title}</h3><p>{item.text}</p></div><Check size={19}/></article>)}</div>
    </div>
   </section>

   <section className="loi-process" id="panel-negocio">
    <div className="container loi-process-layout">
     <div className="loi-process-copy"><span className="loi-overline">{t.dashboard.eyebrow}</span><h2>{t.dashboard.first} <em>{t.dashboard.second}</em></h2><p>{t.dashboard.intro}</p><Link href="/solicitar-acceso" className="loi-text-link">{t.hero.primary} <ArrowUpRight size={18}/></Link></div>
     <div className="loi-process-steps">{t.dashboard.items.map((item,i)=><article className="loi-step" key={item.title}><span><KreyvIcon name={BENEFIT_ICONS[(i+2)%BENEFIT_ICONS.length]} size={25}/></span><div><h3>{item.title}</h3><p>{item.text}</p></div><Check size={19}/></article>)}</div>
    </div>
   </section>

   <section className="loi-design-section" id="personalizacion">
    <div className="container loi-design-layout">
     <div className="loi-design-preview">
      <div className="loi-design-preview-label">{t.design.previewLabel}</div>
      <div className="loi-marketing-card loi-marketing-card-noma"><StampCard locale={lang} name="Café Noma" color="#183E5B" stampColor="#183E5B" reward={lang==="en"?"A coffee on us":"Un café gratis"} total={8} earned={5} icon="coffee" message={lang==="en"?"THANKS FOR COMING BACK":"GRACIAS POR VOLVER"}/></div>
      <div className="loi-stamp-library"><span>{t.design.iconsLabel}</span><div>{["cafeteria","hamburgueseria","restaurante","barberia","peluqueria","pizzeria","panaderia","taqueria","gimnasio","mascotas","floristeria","spa"].map(kind=><span key={kind}><StampMark kind={kind} size={25} color="#5E1A2B"/></span>)}</div></div>
     </div>
     <div className="loi-design-copy"><span className="loi-overline">{t.design.eyebrow}</span><h2>{t.design.first} <em>{t.design.second}</em></h2><p>{t.design.description}</p>
      <div className="loi-design-points">{t.design.points.map(point=><div key={point}><Check size={17}/> {point}</div>)}</div>
      <Link href="/solicitar-acceso" className="loi-button loi-button-main">{t.design.cta} <ArrowUpRight size={18}/></Link>
     </div>
    </div>
   </section>

   <InstallGuide lang={lang}/>

   <section className="loi-final-section" id="empezar"><div className="container"><div className="loi-final-card"><div><span className="loi-overline">{t.final.eyebrow}</span><h2>{t.final.first}<br/><em>{t.final.second}</em></h2><p>{t.final.description}</p><div className="loi-final-actions"><Link href="/solicitar-acceso" className="loi-button loi-button-cream">{t.final.primary} <ArrowUpRight size={19}/></Link><Link href="/acceder" className="loi-final-secondary">{t.final.secondary} <ArrowRight size={17}/></Link></div></div><div className="loi-final-deco" aria-hidden="true"><KreyvIcon name="premios" size={170}/><KreyvIcon name="recompensa" size={58}/></div></div></div></section>
  </main>
  <PublicFooter lang={lang} page="business"/>
 </div>;
}
