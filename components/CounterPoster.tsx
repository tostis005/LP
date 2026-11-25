"use client";
import {useId,useRef,useState} from "react";
import {QRCodeSVG} from "qrcode.react";
import {Download,FileText,Copy,Check} from "lucide-react";
import type {Business,Program} from "@/lib/types";
import {programPromise} from "@/lib/program-presentation";
import {resolveStampIcon} from "@/lib/stamp-drawings";
import {KREYV_ICON_BOXES,KREYV_FILLED_PATHS} from "@/lib/kreyv-icon-paths";
import {publicJoinUrl} from "@/lib/public-url";
import {POSTER_SIZES,posterPdf,rasterPoster,canvasBlob,downloadPoster,posterAssetUrl,CARD_RATIO,type PosterSize} from "@/lib/counter-poster-export";

const wine="#5E1A2B",gold="#D9A23A";
function lines(value:string,max:number,limit=2){
 const words=value.trim().split(/\s+/),result:string[]=[];let line="";
 for(const word of words){if(line&&(line+" "+word).length>max){result.push(line);line=word}else line+=(line?" ":"")+word}
 if(line)result.push(line);
 return result.length>limit?[...result.slice(0,limit-1),result.slice(limit-1).join(" ")]:result;
}
// Keep each line inside its own slot, including long merchant names.
function fit(value:string,width:number,fontSize:number){
 const estimated=Array.from(value).reduce((n,c)=>n+(/[MW@%]/.test(c) ? .95 : /[ilI .,:!]/.test(c) ? .32 : .66),0)*fontSize;
 return estimated>width?{textLength:width,lengthAdjust:"spacingAndGlyphs" as const}:{};
}
export function CounterPoster({business,program}:{business:Business;program:Program}){
 const [size,setSize]=useState<PosterSize>("A6"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[copied,setCopied]=useState(false);
 const ref=useRef<SVGSVGElement>(null),id=useId().replace(/:/g,"");
 const paper=POSTER_SIZES[size],height=105*paper.height/paper.width;
 const cardWidth=82,cardHeight=cardWidth/CARD_RATIO,cardX=(105-cardWidth)/2,cardY=36;
 const printWidth=size==="A5"?1200:960,printLogo=size==="A5"?256:192;
 const url=publicJoinUrl(business.slug),color=business.accent_color||wine,text=business.card_text_color||"#ffffff",stamp=business.stamp_color||wine;
 const count=Math.min(30,Math.max(1,Math.floor(program.reward_cost)||8)),earned=Math.min(3,Math.max(0,count-1)),cols=Math.min(6,Math.ceil(count/Math.ceil(count/6))),rows=Math.ceil(count/cols);
 const dense=count>12,logoSize=dense?8:11, nameY=dense?16:20,gridY=nameY+3;
 const gap=dense ? .7 : 1.1,gridBottom=37.3;
 const diameter=Math.min(7.1,(48-(cols-1)*gap)/cols,(gridBottom-gridY-(rows-1)*gap)/rows),spacing=diameter+gap;
 const message=business.card_text?.trim()||"QUÉ BIEN QUE HAS VUELTO",rewardName=program.reward_label?.trim()||"Recompensa";
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
   <div className="counter-poster-actions"><button type="button" className="button button-dark" disabled={busy} onClick={()=>void save("pdf")}><FileText size={18}/> {busy?"Preparando…":"Descargar PDF"}</button><button type="button" className="button button-outline" disabled={busy} onClick={()=>void save("png")}><Download size={18}/> Descargar PNG</button><button type="button" className="button button-outline" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true)}catch{setError("No se pudo copiar. Abre el enlace que aparece debajo.")}}}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?"Enlace copiado":"Copiar enlace"}</button></div>
   <a className="counter-poster-link" href={url} target="_blank" rel="noreferrer">{url}</a>
   <p className="counter-poster-note">PDF al tamaño seleccionado. Imprime al 100 % y colócalo en un expositor vertical. PNG con resolución equivalente a 300 ppp. La tarjeta es una muestra, no un saldo real.</p>
   {error&&<div className="alert error" role="alert">{error}</div>}
  </div>
  <div className="counter-poster-preview"><svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={"0 0 105 "+height} width={paper.width+"mm"} height={paper.height+"mm"} role="img" aria-label={"Cartel de mostrador de "+business.name} fontFamily="Arial, sans-serif">
   <defs><clipPath id={id+"card"}><rect x={cardX} y={cardY} width={cardWidth} height={cardHeight} rx="4"/></clipPath><clipPath id={id+"logo"}><rect x="4" y="4" width={logoSize} height={logoSize} rx="2"/></clipPath><linearGradient id={id+"shade"} x1="0%" y1="0%" x2="100%" y2="70%"><stop offset="0%" stopColor="#000" stopOpacity=".44"/><stop offset="100%" stopColor="#000" stopOpacity=".20"/></linearGradient></defs>
   <rect width="105" height={height} fill="#fffdf9"/><path d="M0 0H27Q10 5 0 16Z" fill={wine}/><path d="M0 16Q10 5 27 0" fill="none" stroke={gold} strokeWidth=".8"/>
   <path d={"M105 "+height+"H78Q95 "+(height-5)+" 105 "+(height-16)+"Z"} fill={wine}/>
   <g textAnchor="middle" fill={wine}><text x="52.5" y="8.5" fontSize="3.1" fontWeight="700">Este negocio participa en</text>
   <image href="/brand/kreyv-pegada-vino-mostaza-claro.svg" x="31" y="10" width="43" height="11" preserveAspectRatio="xMidYMid meet"/>
   <text x="52.5" y="25" fontSize="5.7" fontWeight="800">Escanea y consigue</text><text x="52.5" y="30.8" fontSize="6.1" fontWeight="800">tu tarjeta</text>
   <text x="52.5" y="34.3" fontSize="2.7">Guárdala en tu móvil y consigue recompensas.</text></g>
   <g clipPath={"url(#"+id+"card)"}><rect x={cardX} y={cardY} width={cardWidth} height={cardHeight} rx="4" fill={color}/>
   {business.card_background&&<><image href={posterAssetUrl(business.card_background,480)} data-print-href={posterAssetUrl(business.card_background,printWidth)} x={cardX} y={cardY} width={cardWidth} height={cardHeight} preserveAspectRatio="xMidYMid slice"/><rect x={cardX} y={cardY} width={cardWidth} height={cardHeight} fill={"url(#"+id+"shade)"}/></>}
   <g transform={"translate("+cardX+" "+cardY+")"}>
    <rect x="4" y="4" width={logoSize} height={logoSize} rx="2" fill="#fffdf1" fillOpacity=".88" stroke="#fff" strokeOpacity=".55" strokeWidth=".25"/>
    {business.logo_url?<image href={posterAssetUrl(business.logo_url,96)} data-print-href={posterAssetUrl(business.logo_url,printLogo)} x="4" y="4" width={logoSize} height={logoSize} preserveAspectRatio="xMidYMid meet" clipPath={"url(#"+id+"logo)"}/>:<text x={4+logoSize/2} y={4+logoSize*.66} textAnchor="middle" fontSize={logoSize*.48} fontWeight="700" fill={wine}>{business.name.slice(0,1).toUpperCase()}</text>}
    <rect x={cardWidth-32} y="4" width="28" height="4.4" rx="2.2" fill="none" stroke={text} strokeOpacity=".85" strokeWidth=".25"/>
    <text x={cardWidth-18} y="6.95" textAnchor="middle" fill={text} fontSize="1.65" fontWeight="700" {...fit("CLUB DE RECOMPENSAS",25,1.65)}>CLUB DE RECOMPENSAS</text>
    <text x="4" y={nameY} fill={text} fontSize={dense?3.7:4.4} fontWeight="800" {...fit(business.name,cardWidth-8,dense?3.7:4.4)}>{business.name}</text>
    {program.type==="stamps"?<>
     {Array.from({length:count},(_,i)=>{const x=4+(i%cols)*spacing+diameter/2,y=gridY+Math.floor(i/cols)*spacing+diameter/2;return <g key={i}><circle cx={x} cy={y} r={diameter/2} fill={i<earned?"#fffdf1":text} fillOpacity={i<earned?1:.10} stroke={i<earned?"#fffdf1":text} strokeOpacity={i<earned?1:.65} strokeWidth=".27" strokeDasharray={i<earned?undefined:".65 .55"}/>{i<earned&&(business.stamp_image_url?<image href={posterAssetUrl(business.stamp_image_url,96)} data-print-href={posterAssetUrl(business.stamp_image_url,192)} x={x-diameter*.39} y={y-diameter*.39} width={diameter*.78} height={diameter*.78} preserveAspectRatio="xMidYMid meet"/>:<svg x={x-diameter*.39} y={y-diameter*.39} width={diameter*.78} height={diameter*.78} viewBox={KREYV_ICON_BOXES[icon]}><path fill={stamp} fillRule="evenodd" d={KREYV_FILLED_PATHS[icon]}/></svg>)}</g>})}
     <text x="4" y="40.5" fill={text} fontSize="2.15" fontWeight="700" {...fit(message,cardWidth-8,2.15)}>{message}</text>
     <text x="4" y="44.5" fill={text} fontSize="2.55" fontWeight="800">{earned} de {count} sellos</text>
     <text x="4" y="48" fill={text} fontSize="2.05" fontWeight="600" {...fit(rewardName,cardWidth-8,2.05)}>{rewardName}</text>
    </>:<><text x="4" y="29" fontSize="4.5" fontWeight="700" fill={text}>{program.type==="points"?"Suma puntos":"Consigue saldo a favor"}</text><text x="4" y="40.5" fontSize="2.15" fontWeight="700" fill={text} {...fit(message,cardWidth-8,2.15)}>{message}</text><text x="4" y="46" fontSize="2.55" fill={text}>Cada compra cuenta</text></>}
   </g></g>
   <rect x="9" y="90" width="87" height="10" rx="2.5" fill="#F8EDD5"/>
   <g textAnchor="middle" fill={wine} fontWeight="700">{reward.map((line,i)=><text key={i} x="52.5" y={reward.length===1?96.2:93.7+i*3.7} fontSize="3.15" {...(line.length>40?{textLength:82,lengthAdjust:"spacingAndGlyphs" as const}:{})}>{line}</text>)}</g>
   <svg x="34.5" y="102" width="36" height="36" viewBox="0 0 360 360"><QRCodeSVG value={url} size={360} level="M" marginSize={4} fgColor="#000000" bgColor="#ffffff"/></svg>
   <text x="52.5" y="141.5" textAnchor="middle" fontSize="3.2" fontWeight="700" fill={wine}>Escanea aquí · kreyvi.com</text>
   <text x="52.5" y="145.5" textAnchor="middle" fontSize="2.2" fill={wine}>Gratis · Añádela a tus tarjetas de Kreyvi.</text>
  </svg></div>
 </section>;
}
