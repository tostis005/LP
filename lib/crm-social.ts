export function socialLink(kind:"instagram"|"facebook"|"whatsapp",value?:string|null){
 const raw=value?.trim()||"";
 if(!raw)return undefined;
 if(kind==="whatsapp"&&/^\+[\d\s().-]+$/.test(raw)){const n=raw.replace(/\D/g,"");return n.length>=8&&n.length<=15?"https://wa.me/"+n:undefined;}
 if(kind!=="whatsapp"&&/^@?[a-z0-9._-]+$/i.test(raw))return "https://www."+kind+".com/"+raw.replace(/^@/,"")+"/";
 try{const url=new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw)?raw:"https://"+raw),host=url.hostname.toLowerCase();
 const allowed=kind==="whatsapp"?["wa.me","api.whatsapp.com","web.whatsapp.com","chat.whatsapp.com"]:kind==="facebook"?["facebook.com","www.facebook.com","m.facebook.com","fb.com","fb.me"]:["instagram.com","www.instagram.com","m.instagram.com"];
 return ["https:","http:"].includes(url.protocol)&&allowed.includes(host)&&!url.username&&!url.password?url.href:undefined;
 }catch{return undefined;}
}
