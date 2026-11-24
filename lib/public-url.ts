/** Stable production origin for links intended to be shared outside this device. */
export const PUBLIC_SITE_URL="https://kreyvi.com";
export function publicJoinPath(slug:string){return "/unirse/"+encodeURIComponent(slug)}
export function publicJoinUrl(slug:string){return PUBLIC_SITE_URL+publicJoinPath(slug)}
export function safeJoinTarget(value:unknown):string|null{
 return typeof value==="string"&&/^\/unirse\/[a-z0-9][a-z0-9-]{0,159}(?:\?alta=1)?$/i.test(value)?value:null;
}
/** Old asset URLs still point to the same storage. Keep custom external images intact. */
export function canonicalAssetUrl(value:string){return value.replace(/^https?:\/\/169\.58\.121\.198(?::\d+)?(?=\/api\/assets\/)/,PUBLIC_SITE_URL)}
