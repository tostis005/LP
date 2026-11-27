import type {Metadata} from "next";
import WaitlistForm from "./WaitlistForm";
import "./waitlist.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Lista de espera | Kreyvi",description:"Sé de los primeros en disfrutar de Kreyvi en tu ciudad."};
export default function Page(){
 const pixelId=process.env.META_PIXEL_ID||"";
 return <main className="waitlist-page"><section className="waitlist-card">
 <img className="waitlist-logo" src="/brand/kreyv-pegada-vino-mostaza-claro.svg" alt="Kreyvi"/>
 <WaitlistForm pixelId={/^\d{5,30}$/.test(pixelId)?pixelId:""}/>
 </section></main>;
}
