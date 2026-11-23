/** Optimized width for card backgrounds, preserving existing external URLs. */
export function cardBackgroundUrl(url:string|null|undefined,width:720|1200=720):string|undefined{
 if(!url)return undefined;
 if(!url.includes("/api/assets/business-assets/"))return url;
 return url+(url.includes("?")?"&":"?")+"w="+width;
}
