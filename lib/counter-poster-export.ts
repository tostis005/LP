export const POSTER_SIZES={A6:{width:105,height:148},A5:{width:148,height:210}} as const;
export type PosterSize=keyof typeof POSTER_SIZES;
export const PRINT_DPI=300;
const encode=(s:string)=>new TextEncoder().encode(s);
const mmToPt=(mm:number)=>(mm*72/25.4).toFixed(5);
/** Single-page PDF with exact ISO paper size and a high-resolution embedded image. */
export function posterPdf(jpeg:Uint8Array,pixels:{width:number;height:number},size:PosterSize):Blob{
 const paper=POSTER_SIZES[size],w=mmToPt(paper.width),h=mmToPt(paper.height);
 const parts:Uint8Array<ArrayBuffer>[]=[];let length=0;
 const push=(data:string|Uint8Array)=>{const bytes=typeof data==="string"?encode(data):new Uint8Array(data);parts.push(bytes);length+=bytes.length};
 const offsets=[0];push("%PDF-1.4\n%Kreyvi\n");
 function obj(n:number,body:string){offsets[n]=length;push(n+" 0 obj\n"+body+"\nendobj\n")}
 obj(1,"<< /Type /Catalog /Pages 2 0 R >>");
 obj(2,"<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
 obj(3,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+w+" "+h+"] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
 offsets[4]=length;push("4 0 obj\n<< /Type /XObject /Subtype /Image /Width "+pixels.width+" /Height "+pixels.height+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+jpeg.length+" >>\nstream\n");push(jpeg);push("\nendstream\nendobj\n");
 const commands="q\n"+w+" 0 0 "+h+" 0 0 cm\n/Im0 Do\nQ\n";
 obj(5,"<< /Length "+encode(commands).length+" >>\nstream\n"+commands+"endstream");
 const xref=length;push("xref\n0 6\n0000000000 65535 f \n"+offsets.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")+"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n");
 return new Blob(parts,{type:"application/pdf"});
}
function readData(blob:Blob){return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error("No se pudo preparar una imagen."));r.readAsDataURL(blob)})}
export async function rasterPoster(svg:SVGSVGElement,size:PosterSize){
 const clone=svg.cloneNode(true) as SVGSVGElement;
 // Embed all images before rasterization; no cross-origin canvas contamination.
 await Promise.all(Array.from(clone.querySelectorAll("image")).map(async image=>{
  const href=image.getAttribute("href");if(!href||href.startsWith("data:"))return;
  const response=await fetch(href,{credentials:"same-origin"});
  if(!response.ok)throw new Error("No se pudo cargar una imagen del diseño. Vuelve a intentarlo.");
  image.setAttribute("href",await readData(await response.blob()));
 }));
 const paper=POSTER_SIZES[size],canvas=document.createElement("canvas");
 canvas.width=Math.round(paper.width/25.4*PRINT_DPI);canvas.height=Math.round(paper.height/25.4*PRINT_DPI);
 clone.setAttribute("width",String(canvas.width));clone.setAttribute("height",String(canvas.height));
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:"image/svg+xml;charset=utf-8"}));
 try{
  const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("No se pudo generar el cartel."));image.src=url});
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("El navegador no permite exportar el cartel.");
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas;
 }finally{URL.revokeObjectURL(url)}
}
export function canvasBlob(canvas:HTMLCanvasElement,type:"image/png"|"image/jpeg"){return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("No se pudo exportar el archivo.")),type,.99))}
export function downloadPoster(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000)}
