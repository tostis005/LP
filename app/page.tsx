import Link from "next/link";
import {ArrowUpRight, Gift, MapPin, WalletCards, Smartphone, Heart, Check} from "lucide-react";
import {PublicHeader} from "@/components/PublicHeader";
import {PublicFooter} from "@/components/PublicFooter";
import {LandingLanguageSync} from "@/components/LandingLanguageSync";
import {publicHref} from "@/lib/public-navigation";
import {CARD_DESIGNS} from "@/lib/card-designs";
import type {LandingLanguage} from "@/lib/landing-copy";
import {StampCard} from "@/components/StampCard";
import "./customer-entry.css";
import {InstalledAppEntry} from "@/components/InstalledAppEntry";
// Public HTML must be generated for the current deployment, not a stale static root.
export const dynamic="force-dynamic";
export default async function Home({searchParams}:{searchParams:Promise<{lang?:string|string[]}>}){
 const lang:LandingLanguage=(await searchParams).lang==="en"?"en":"es",en=lang==="en";
 return <CustomerHome lang={lang}/>;
}
function CustomerHome({lang="es"}:{lang?:LandingLanguage}){
 const en=lang==="en";
 return <><InstalledAppEntry/><main className="customer-public" data-public-landing="customer">
  <LandingLanguageSync lang={lang}/><PublicHeader lang={lang} page="customer"/>
  <section className="customer-public-hero"><div className="customer-public-hero-inner"><div className="customer-public-copy"><span className="customer-public-kicker"><Heart size={15}/> {en?"EVERY VISIT COUNTS":"CADA VISITA CUENTA"}</span><h1>{en?"Your favorite places.":"Tus lugares favoritos."}<br/><em>{en?"Your next rewards.":"Tus próximos premios."}</em></h1><p>{en?"All your loyalty cards in one place. Collect stamps, discover local businesses and enjoy your rewards.":"Todas tus tarjetas de fidelización en un solo lugar. Suma sellos, descubre nuevos negocios y disfruta de las recompensas que mereces."}</p><div className="customer-public-actions"><Link href="/entrar" className="customer-public-primary">{en?"My cards":"Mis tarjetas"} <ArrowUpRight size={20}/></Link><Link href={publicHref("app",lang)} className="customer-public-secondary"><Smartphone size={19}/> {en?"Install the app":"Instalar la app"}</Link></div><div className="customer-public-reassurance"><Check size={17}/> {en?"Free, paperless and always with you.":"Gratis, sin tarjetas de papel y siempre contigo."}</div></div>
  <div className="customer-public-art" aria-label={en?"Loyalty card examples":"Ejemplo de tarjetas de fidelización"}><div className="customer-public-orbit orbit-one" aria-hidden="true"/><div className="customer-public-orbit orbit-two" aria-hidden="true"/><div className="customer-public-art-eyebrow"><Heart size={15}/> {en?"YOUR CARDS, YOUR WAY":"TUS TARJETAS, A TU MANERA"}</div><div className="customer-public-card card-one"><StampCard {...CARD_DESIGNS[0].preview} locale={lang} name={en?"Your favorite café":"Tu cafetería favorita"} reward={en?"Your next coffee is free":"Tu próximo café gratis"} total={8} earned={5}/></div><div className="customer-public-card card-two"><StampCard {...CARD_DESIGNS[1].preview} locale={lang} name={en?"Your ice cream shop":"Tu heladería"} reward={en?"A scoop on us":"Una bola de regalo"} total={6} earned={2}/></div><div className="customer-public-art-tag"><Gift size={20}/> {en?"Every visit brings a reward closer":"Cada visita te acerca a un premio"}</div></div></div></section>
  <section className="customer-public-benefit-section" aria-labelledby="customer-benefits-title"><div className="customer-public-section-head"><span>{en?"SMALL MOMENTS, BIG REWARDS":"PEQUEÑOS GESTOS, GRANDES RECOMPENSAS"}</span><h2 id="customer-benefits-title">{en?"It pays to come back.":"Volver tiene premio."}</h2><p>{en?"Enjoy your favorite businesses without the hassle.":"Disfruta de tus negocios favoritos, sin complicaciones."}</p></div><div className="customer-public-benefits"><article><span className="customer-benefit-icon"><WalletCards/></span><h2>{en?"All on your phone":"Todo en tu móvil"}</h2><p>{en?"Never lose a card again.":"No pierdas nunca más una tarjeta."}</p></article><article><span className="customer-benefit-icon"><Gift/></span><h2>{en?"Real rewards":"Premios de verdad"}</h2><p>{en?"Track your stamps and rewards.":"Consulta tus sellos y recompensas."}</p></article><article><span className="customer-benefit-icon"><MapPin/></span><h2>{en?"Discover nearby":"Descubre cerca de ti"}</h2><p>{en?"Find new favorite places.":"Encuentra nuevos lugares favoritos."}</p></article></div></section><section className="customer-public-end"><div><span>{en?"ALWAYS WITH YOU":"SIEMPRE CONTIGO"}</span><h2>{en?"Your next rewards are waiting.":"Tus próximos premios te esperan."}</h2></div><Link href="/entrar" className="customer-public-primary">{en?"Get started":"Empezar ahora"} <ArrowUpRight size={18}/></Link></section>
  <PublicFooter lang={lang} page="customer"/>
 </main></>;
}
