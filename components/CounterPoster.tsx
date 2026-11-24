"use client";
import {useId,useRef,useState} from "react";
import {QRCodeSVG} from "qrcode.react";
import {Download,FileText,Copy,Check} from "lucide-react";
import type {Business,Program} from "@/lib/types";
import {programPromise} from "@/lib/program-presentation";
import {resolveStampIcon} from "@/lib/stamp-drawings";
import {KREYV_ICON_BOXES,KREYV_FILLED_PATHS} from "@/lib/kreyv-icon-paths";
import {canonicalAssetUrl,publicJoinUrl} from "@/lib/public-url";
import {POSTER_SIZES,posterPdf,rasterPoster,canvasBlob,downloadPoster,type PosterSize} from "@/lib/counter-poster-export";

const wine="#5E1A2B",gold="#D9A23A",cream="#F5EFE6";
function lines(value:string,max:number,limit=2){
 const words=value.trim().split(/\s+/),result:string[]=[];let line="";
 for(const word of words){if(line&&(line+" "+word).length>max){result.push(line);line=word}else line+=(line?" ":"")+word}
 if(line)result.push(line);
 return result.length>limit?[...result.slice(0,limit-1),result.slice(limit-1).join(" ")]:result;
}
function fit(value:string,max:number){return value.length>max?{textLength:max*2.05,lengthAdjust:"spacingAndGlyphs" as const}:{}}
export function CounterPoster({business,program}:{business:Business;program:Program}){
 const [size,setSize]=useState<PosterSize>("A6"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[copied,setCopied]=useState(false);
 const ref=useRef<SVGSVGElement>(null),id=useId().replace(/:/g,"");
 const paper=POSTER_SIZES[size],height=105*paper.height/paper.width;
 const url=publicJoinUrl(business.slug),color=business.accent_color||wine,text=business.card_text_color||"#ffffff",stamp=business.stamp_color||wine;
 const count=Math.min(30,Math.max(1,Math.floor(program.reward_cost)||8)),earned=Math.min(5,Math.max(0,count-1)),cols=Math.min(10,Math.ceil(count/Math.ceil(count/10))),rows=Math.ceil(count/cols);
 const diameter=Math.min(9,69/cols,(18-(rows-1)*1.3)/rows),spacing=diameter+1.3;
 const icon=resolveStampIcon(business.stamp_icon),reward=lines(programPromise(program),40);
 async function save(format:"pdf"|"png"){
  if(!ref.current||busy)return;setBusy(true);setError("");
  try{const canvas=await rasterPoster(ref.current,size);const name="kreyvi-mostrador-"+business.slug+"-"+size.toLowerCase();
   if(format==="png")downloadPoster(await canvasBlob(canvas,"image/png"),name+".png");
   else{const jpeg=await canvasBlob(canvas,"image/jpeg");downloadPoster(posterPdf(new Uint8Array(await jpeg.arrayBuffer()),canvas,size),name+".pdf")}
  }catch(e){setError(e instanceof Error?e.message:"No se pudo generar el cartel.")}finally{setBusy(false)}
 }
 return <section className="panel-card counter-poster-panel">
  <div className="counter-poster-controls"><span className="eyebrow">MATERIAL PARA TU LOCAL</span><h3>Cartel para mostrador</h3><p>Invita a tus clientes a conseguir su tarjeta. El cartel utiliza el diseño de tu negocio y un QR exclusivo para su alta.</p>
   <label>Formato de impresión<select value={size} onChange={e=>setSize(e.target.value as PosterSize)} disabled={busy}><option value="A6">A6 · 105 × 148 mm</option><option value="A5">A5 · 148 × 210 mm</option></select></label>
   <div className="counter-poster-actions"><button type="button" className="button button-dark" disabled={busy} onClick={()=>void save("pdf")}><FileText size={18}/> {busy?"Preparando…":"Descargar PDF"}</button><button type="button" className="button button-outline" disabled={busy} onClick={()=>void save("png")}><Download size={18}/> Descargar PNG</button><button type="button" className="button button-outline" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true)}catch{setError("No se pudo copiar. Abre el enlace que aparece debajo.")}}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?"Enlace copiado":"Copiar enlace"}</button></div>
   <a className="counter-poster-link" href={url} target="_blank" rel="noreferrer">{url}</a>
   <p className="counter-poster-note">PDF al tamaño seleccionado. Imprime al 100 % y colócalo en un expositor vertical. PNG con resolución equivalente a 300 ppp. La tarjeta es una muestra, no un saldo real.</p>
   {error&&<div className="alert error" role="alert">{error}</div>}
  </div>
  <div className="counter-poster-preview"><svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={"0 0 105 "+height} width={paper.width+"mm"} height={paper.height+"mm"} role="img" aria-label={"Cartel de mostrador de "+business.name} fontFamily="Arial, sans-serif">
   <defs><clipPath id={id+"card"}><rect x="8" y="40" width="89" height="44" rx="4"/></clipPath><clipPath id={id+"logo"}><rect x="12" y="44" width="11" height="11" rx="2"/></clipPath></defs>
   <rect width="105" height={height} fill="#fffdf9"/><path d="M0 0H27Q10 5 0 16Z" fill={wine}/><path d="M0 16Q10 5 27 0" fill="none" stroke={gold} strokeWidth=".8"/>
   <path d={"M105 "+height+"H78Q95 "+(height-5)+" 105 "+(height-16)+"Z"} fill={wine}/>
   <g textAnchor="middle" fill={wine}><text x="52.5" y="8.5" fontSize="3.1" fontWeight="700">Este negocio participa en</text>
   <image href="/brand/kreyv-pegada-vino-mostaza-claro.svg" x="31" y="10" width="43" height="11" preserveAspectRatio="xMidYMid meet"/>
   <text x="52.5" y="27" fontSize="6.1" fontWeight="800">Escanea y consigue</text><text x="52.5" y="33.3" fontSize="6.1" fontWeight="800">tu tarjeta</text>
   <text x="52.5" y="37.5" fontSize="2.7">Guárdala en tu móvil y consigue recompensas.</text></g>
   <g clipPath={"url(#"+id+"card)"}><rect x="8" y="40" width="89" height="44" rx="4" fill={color}/>
   {business.card_background&&<><image href={canonicalAssetUrl(business.card_background)} x="8" y="40" width="89" height="44" preserveAspectRatio="xMidYMid slice"/><rect x="8" y="40" width="89" height="44" fill="#000" opacity=".22"/></>}
   <rect x="12" y="44" width="11" height="11" rx="2" fill={cream}/>
   {business.logo_url?<image href={canonicalAssetUrl(business.logo_url)} x="12" y="44" width="11" height="11" preserveAspectRatio="xMidYMid meet" clipPath={"url(#"+id+"logo)"}/>:<text x="17.5" y="51.4" textAnchor="middle" fontSize="5" fontWeight="700" fill={wine}>{business.name.slice(0,1).toUpperCase()}</text>}
   <text x="26" y="48.5" fill={text} fontSize="4.1" fontWeight="700" {...fit(business.name,28)}>{business.name}</text>
   <text x="26" y="53.5" fill={text} fontSize="2.5" fontWeight="700">CLUB DE RECOMPENSAS</text>
   {program.type==="stamps"?<>
    {Array.from({length:count},(_,i)=>{const x=52.5-(cols*spacing-1.3)/2+(i%cols)*spacing+diameter/2,y=57+(Math.floor(i/cols))*spacing+diameter/2;return <g key={i}><circle cx={x} cy={y} r={diameter/2} fill={i<earned?cream:"none"} stroke={i<earned?cream:text} strokeOpacity={i<earned?1:.65} strokeWidth=".35" strokeDasharray={i<earned?undefined:"1 1"}/>{i<earned&&(business.stamp_image_url?<image href={canonicalAssetUrl(business.stamp_image_url)} x={x-diameter*.36} y={y-diameter*.36} width={diameter*.72} height={diameter*.72} preserveAspectRatio="xMidYMid meet"/>:<svg x={x-diameter*.36} y={y-diameter*.36} width={diameter*.72} height={diameter*.72} viewBox={KREYV_ICON_BOXES[icon]}><path fill={stamp} fillRule="evenodd" d={KREYV_FILLED_PATHS[icon]}/></svg>)}</g>})}
    <text x="12" y="80.5" fontSize="2.7" fontWeight="700" fill={text}>Tarjeta de ejemplo · {earned} de {count} sellos</text>
    {business.card_text&&<text x="12" y="55.9" fontSize="1.9" fill={text} {...(business.card_text.length>60?{textLength:80,lengthAdjust:"spacingAndGlyphs" as const}:{})}>{business.card_text}</text>}
   </>:<><text x="52.5" y="69" textAnchor="middle" fontSize="5.5" fontWeight="700" fill={text}>{program.type==="points"?"Suma puntos":"Consigue saldo a favor"}</text><text x="52.5" y="74" textAnchor="middle" fontSize="3.1" fill={text}>Cada compra cuenta</text></>}
   </g>
   <rect x="8" y="86" width="89" height="11" rx="2.5" fill="#F8EDD5"/>
   <g textAnchor="middle" fill={wine} fontWeight="700">{reward.map((line,i)=><text key={i} x="52.5" y={reward.length===1?92.6:90.1+i*3.8} fontSize="3.15" {...(line.length>46?{textLength:82,lengthAdjust:"spacingAndGlyphs" as const}:{})}>{line}</text>)}</g>
   <svg x="34.5" y="98" width="36" height="36" viewBox="0 0 360 360"><QRCodeSVG value={url} size={360} level="M" marginSize={4} fgColor="#000000" bgColor="#ffffff"/></svg>
   <text x="52.5" y="137.5" textAnchor="middle" fontSize="3.2" fontWeight="700" fill={wine}>Escanea aquí · kreyvi.com</text>
   <text x="52.5" y="141.8" textAnchor="middle" fontSize="2.4" fill={wine}>Crea tu cuenta o añade la tarjeta a la que ya tienes.</text>
  </svg></div>
 </section>;
}
