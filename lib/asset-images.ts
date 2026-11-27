/** Small cached WebP variants for already uploaded logos and custom stamps. */
function imageVariant(url:string|null|undefined,width:96|192|256|512):string|undefined{
 if(!url)return undefined;
 url=url.replace(/^https?:\/\/(?:169\.58\.121\.198(?::\d+)?|(?:www\.)?kreyvi(?:app)?\.com)(?=\/api\/assets\/)/,"https://kreyviapp.com");
 if(!url.includes("/api/assets/business-assets/"))return url;
 return url+(url.includes("?")?"&":"?")+"w="+width;
}
export const logoImageUrl=imageVariant;
export const stampImageUrl=imageVariant;
