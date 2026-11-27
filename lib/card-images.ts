/** Optimized width for card backgrounds, preserving existing external URLs. */
export function cardBackgroundUrl(url:string|null|undefined,width:720|1200=720):string|undefined{
 if(!url)return undefined;
 url=url.replace(/^https?:\/\/(?:169\.58\.121\.198(?::\d+)?|(?:www\.)?kreyvi(?:app)?\.com)(?=\/api\/assets\/)/,"https://kreyviapp.com");
 if(!url.includes("/api/assets/business-assets/"))return url;
 return url+(url.includes("?")?"&":"?")+"w="+width;
}
