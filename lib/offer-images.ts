/** Optimized versions of promotional assets. Third-party URLs are left untouched. */
export function offerImageUrl(value:string|null|undefined,width:480|960=480):string|undefined{
 if(!value)return undefined;
 if(!value.includes("/api/assets/business-assets/"))return value;
 return value+(value.includes("?")?"&":"?")+"w="+width;
}
