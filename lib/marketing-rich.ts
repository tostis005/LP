/** Mensajes enriquecidos de origen no confiable -> HTML permitido de correo.
 * Nunca se envía HTML introducido por el comercio sin escapar. */
function escapeHtml(input:string){
 return input.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function formatInline(raw:string){
 const safe=escapeHtml(raw);
 return safe.replace(/\*\*([^*\n]{1,500})\*\*/g,"<strong>$1</strong>")
  .replace(/_([^_\n]{1,500})_/g,"<em>$1</em>")
  .replace(/\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]{1,400})\)/g,(_,label,url)=>{
   // URLs escaped above (including quote characters). Only web links are supported.
   return '<a href="'+url+'" rel="noopener noreferrer">'+label+"</a>";
  });
}
export function safeCampaignHtml(markdown:string):string{
 const lines=markdown.replace(/\r\n?/g,"\n").slice(0,12000).split("\n");
 const parts:string[]=[];let list=false;
 for(const line of lines){
  const m=line.match(/^\s*[-•]\s+(.+)$/);
  if(m){if(!list){parts.push("<ul>");list=true;}parts.push("<li>"+formatInline(m[1])+"</li>");continue;}
  if(list){parts.push("</ul>");list=false;}
  if(!line.trim()){parts.push("<div style=\"height:10px\"></div>");continue;}
  parts.push("<p style=\"margin:0 0 9px;line-height:1.65\">"+formatInline(line)+"</p>");
 }
 if(list)parts.push("</ul>");
 return parts.join("");
}
export function campaignPlainText(markdown:string):string{
 return markdown.replace(/\*\*([^*]+)\*\*/g,"$1")
  .replace(/_([^_]+)_/g,"$1")
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,"$1 ($2)").trim();
}
export function campaignWhatsAppText(markdown:string):string{
 return markdown.replace(/\*\*([^*\n]+)\*\*/g,"*$1*")
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,"$1 $2").trim();
}
export function campaignEmailHtml(body:string,brand:string,unsubscribeUrl:string):string{
 const name=escapeHtml(brand),url=escapeHtml(unsubscribeUrl);
 return '<!doctype html><html lang="es"><meta charset="utf-8"><body style="margin:0;background:#faf5f8;font-family:Arial,sans-serif;color:#2d1b24">'
  +'<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px">'
  +'<table role="presentation" style="max-width:600px;width:100%;background:#fff;border:1px solid #eadce4;border-radius:17px" cellspacing="0" cellpadding="0">'
  +'<tr><td style="background:#571c32;color:white;padding:24px 28px;border-radius:17px 17px 0 0;font-size:20px;font-weight:bold">'+name+'</td></tr>'
  +'<tr><td style="padding:28px 28px 20px;font-size:15px;line-height:1.7">'+safeCampaignHtml(body)+'</td></tr>'
  +'<tr><td style="padding:20px 28px 26px;border-top:1px solid #eadce4;font-size:12px;color:#7b6571;line-height:1.7">'
  +'Recibes este mensaje porque aceptaste las comunicaciones de '+name+'.<br>'
  +'<a style="color:#571c32" href="'+url+'">Dejar de recibir mensajes</a></td></tr></table></td></tr></table></body></html>';
}
