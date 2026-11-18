import Link from "next/link";
import { Check, ArrowUpRight, Minus } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
const features = ["Tarjetas digitales personalizadas","Sellos, puntos y cashback","Clientes y movimientos","Empleados y permisos","Panel de estadísticas","Directorio de negocios","QR y canje de recompensas","Historial y controles antifraude"];
export default function Pricing() { return <><PublicHeader/><main className="pricing-page container"><div className="eyebrow">PRECIOS CLAROS</div><h1>Más fidelidad.<br/><em>Menos costes.</em></h1><p>Planes pensados para pequeños negocios que quieren crecer. Sin hardware específico ni complejidad.</p><div className="plan-grid">
<article className="plan-card"><span className="plan-label">BUSINESS</span><h2>19,90 €<small>/mes</small></h2><p>Todo lo necesario para empezar a fidelizar.</p><Link className="button button-dark" href="/solicitar-acceso">Solicitar alta <ArrowUpRight size={17}/></Link><div className="plan-features">{features.map(x=><div key={x}><Check size={17}/>{x}</div>)}</div></article>
<article className="plan-card plan-premium"><span className="plan-label">GROWTH · PRÓXIMAMENTE</span><h2>A medida</h2><p>Más automatización, marketing y funciones avanzadas.</p><span className="button button-outline disabled-button">Próximamente</span><div className="plan-features">{["Todo lo incluido en Business","Campañas de email y segmentación","Integraciones TPV","Informes avanzados"].map(x=><div key={x}><Check size={17}/>{x}</div>)}</div></article>
</div><div className="pricing-footnote">Los precios son orientativos durante el desarrollo y pueden cambiar antes del lanzamiento. La emisión de pases Wallet y el envío real de campañas requieren servicios externos.</div></main></>;
}
