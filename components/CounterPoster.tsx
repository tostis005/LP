"use client";
import {useRef,useState} from "react";
import {QRCodeSVG} from "qrcode.react";
import {Download,FileText,Copy,Check} from "lucide-react";
import type {Business,Program} from "@/lib/types";
import {publicJoinUrl} from "@/lib/public-url";
import {POSTER_SIZES,posterPdf,rasterPoster,canvasBlob,downloadPoster,type PosterSize} from "@/lib/counter-poster-export";

const wine="#5E1A2B",gold="#D9A23A";
export function CounterPoster({business}:{business:Business;program:Program}){
 const [size,setSize]=useState<PosterSize>("A6"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[copied,setCopied]=useState(false);
 const ref=useRef<SVGSVGElement>(null);
 const paper=POSTER_SIZES[size],height=105*paper.height/paper.width;
 const url=publicJoinUrl(business.slug);
 async function save(format:"pdf"|"png"){
  if(!ref.current||busy)return;setBusy(true);setError("");
  try{const canvas=await rasterPoster(ref.current,size);const name="kreyvi-mostrador-"+business.slug+"-"+size.toLowerCase();
   if(format==="png")downloadPoster(await canvasBlob(canvas,"image/png"),name+".png");
   else{const jpeg=await canvasBlob(canvas,"image/jpeg");downloadPoster(posterPdf(new Uint8Array(await jpeg.arrayBuffer()),canvas,size),name+".pdf")}
  }catch(e){setError(e instanceof Error?e.message:"No se pudo generar el cartel.")}finally{setBusy(false)}
 }
 return <section className="panel-card counter-poster-panel">
  <div className="counter-poster-controls"><span className="eyebrow">MATERIAL PARA TU LOCAL</span><h3>Cartel para mostrador</h3><p>Invita a tus clientes a conseguir su tarjeta. El diseño es universal: solo cambia el QR de alta de tu negocio. Puedes seguir usando el cartel aunque cambies tu tarjeta o recompensa.</p>
   <label>Formato de impresión<select value={size} onChange={e=>setSize(e.target.value as PosterSize)} disabled={busy}><option value="A6">A6 · 105 × 148 mm</option><option value="A5">A5 · 148 × 210 mm</option></select></label>
   <div className="counter-poster-actions"><button type="button" className="button button-dark" disabled={busy} onClick={()=>void save("pdf")}><FileText size={18}/> {busy?"Preparando…":"Descargar PDF"}</button><button type="button" className="button button-outline" disabled={busy} onClick={()=>void save("png")}><Download size={18}/> Descargar PNG</button><button type="button" className="button button-outline" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true)}catch{setError("No se pudo copiar. Abre el enlace que aparece debajo.")}}}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?"Enlace copiado":"Copiar enlace"}</button></div>
   <a className="counter-poster-link" href={url} target="_blank" rel="noreferrer">{url}</a>
   <p className="counter-poster-note">PDF al tamaño seleccionado. Imprime al 100 % y colócalo en un expositor vertical. PNG con resolución equivalente a 300 ppp.</p>
   {error&&<div className="alert error" role="alert">{error}</div>}
  </div>
  <div className="counter-poster-preview"><svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={"0 0 105 "+height} width={paper.width+"mm"} height={paper.height+"mm"} role="img" aria-label={"Cartel de mostrador de "+business.name} fontFamily="Arial, sans-serif">
   <rect width="105" height={height} fill="#fffdf9"/>
   <path d="M0 0H27Q10 5 0 16Z" fill={wine}/><path d="M0 16Q10 5 27 0" fill="none" stroke={gold} strokeWidth=".8"/>
   <path d={"M105 "+height+"H78Q95 "+(height-5)+" 105 "+(height-16)+"Z"} fill={wine}/>
   <image href="/brand/kreyv-pegada-vino-mostaza-claro.svg" x="29" y="12" width="47" height="13" preserveAspectRatio="xMidYMid meet"/>
   <g textAnchor="middle" fill={wine}>
    <text x="52.5" y="34" fontSize="3.2" fontWeight="700" letterSpacing=".65">TU CLUB DE RECOMPENSAS</text>
    <text x="52.5" y="45" fontSize="7.4" fontWeight="800">Cada visita</text>
    <text x="52.5" y="53" fontSize="7.4" fontWeight="800">tiene premio.</text>
    <text x="52.5" y="61" fontSize="3.6">Consigue tu tarjeta digital gratis.</text>
   </g>
   <rect x="22.5" y="68" width="60" height="60" rx="4" fill="#fff" stroke={gold} strokeWidth=".65"/>
   <svg x="26.5" y="72" width="52" height="52" viewBox="0 0 360 360"><QRCodeSVG value={url} size={360} level="M" marginSize={4} fgColor="#000000" bgColor="#ffffff"/></svg>
   <g textAnchor="middle" fill={wine}>
    <text x="52.5" y="135" fontSize="4.3" fontWeight="800">Escanea y empieza</text>
    <text x="52.5" y="141" fontSize="2.9">Sin descargar ninguna app · kreyvi.com</text>
   </g>
  </svg></div>
 </section>;
}
