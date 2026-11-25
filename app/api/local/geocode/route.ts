import {actorFromRequest,asActor,ApiError,checkOrigin,responseError} from "@/lib/server/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Hit={lat:number;lng:number;label:string;address?:string;city?:string;country?:string};
const cache=new Map<string,{expires:number;hits:Hit[]}>();
let lastLookup=0,geoDay="",geoCount=0;
const lastByUser=new Map<string,number>();
async function merchant(request:Request){
 const user=await actorFromRequest(request);
 if(!user)throw new ApiError("Inicia sesión para buscar direcciones.",401);
 const allowed=await asActor(user,async c=>(await c.query("SELECT public.is_platform_admin() OR EXISTS(SELECT 1 FROM public.business_members WHERE user_id=auth.uid() AND active AND role IN ('owner','manager')) AS allowed")).rows[0]?.allowed);
 if(!allowed)throw new ApiError("No tienes permiso para buscar direcciones de negocios.",403);
 return user;
}
export async function GET(request:Request){
 try{await merchant(request);return Response.json({autocomplete:!!process.env.GEOAPIFY_API_KEY},{headers:{"Cache-Control":"private, no-store"}})}catch(e){return responseError(e)}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const user=await merchant(request);
  const raw=await request.text();
  if(raw.length>600)throw new ApiError("La dirección es demasiado larga.",413);
  const input=JSON.parse(raw) as {q?:string;autocomplete?:boolean};
  const q=String(input.q||"").trim().replace(/\s+/g," ");
  if(q.length<7||q.length>220)throw new ApiError("Introduce una dirección válida.");
  const apiKey=process.env.GEOAPIFY_API_KEY;
  if(input.autocomplete&&!apiKey)return Response.json({results:[]});
  const provider=apiKey?"geoapify":"nominatim",key=provider+":"+Boolean(input.autocomplete)+":"+q.toLowerCase(),cached=cache.get(key);
  if(cached&&cached.expires>Date.now())return Response.json({results:cached.hits,provider});
  const now=Date.now();
  let hits:Hit[]=[];
  if(apiKey){
   if(now-(lastByUser.get(user.id)||0)<650)throw new ApiError("Espera un momento para volver a buscar.",429);
   if(lastByUser.size>1000)lastByUser.clear();
   lastByUser.set(user.id,now);
   const day=new Date().toISOString().slice(0,10);
   if(day!==geoDay){geoDay=day;geoCount=0}
   // Conservative in-process budget; also restrict the API key quota in Geoapify.
   if(geoCount>=2500)throw new ApiError("Se alcanzó el límite diario de búsquedas. Coloca el pin en el mapa.",429);
   geoCount++;
   const u=new URL("https://api.geoapify.com/v1/geocode/"+(input.autocomplete?"autocomplete":"search"));
   u.searchParams.set("text",q);u.searchParams.set("format","json");u.searchParams.set("lang","es");u.searchParams.set("limit","5");u.searchParams.set("apiKey",apiKey);
   const r=await fetch(u,{signal:AbortSignal.timeout(9000),cache:"no-store"});
   if(!r.ok)throw new ApiError("El buscador no está disponible. Puedes marcar la ubicación en el mapa.",503);
   const d=await r.json() as {results?:{lat:number;lon:number;formatted:string;address_line1?:string;city?:string;town?:string;village?:string;country?:string}[]};
   hits=(d.results||[]).map(v=>({lat:Number(v.lat),lng:Number(v.lon),label:v.formatted,address:v.address_line1,city:v.city||v.town||v.village,country:v.country}));
  }else{
   if(now-lastLookup<1300)throw new ApiError("Hay muchas búsquedas. Inténtalo de nuevo en unos segundos.",429);
   lastLookup=now;
   const base=process.env.NEXT_PUBLIC_SITE_URL||"https://kreyvi.com";
   const u=new URL(process.env.GEOCODER_SEARCH_URL||"https://nominatim.openstreetmap.org/search");
   u.searchParams.set("q",q);u.searchParams.set("format","jsonv2");u.searchParams.set("limit","5");u.searchParams.set("addressdetails","1");
   const r=await fetch(u,{headers:{"User-Agent":"Kreyvi/1.0 (address-search; "+base+")","Referer":base,"Accept-Language":"es"},signal:AbortSignal.timeout(11000),cache:"no-store"});
   if(!r.ok)throw new ApiError("El buscador gratuito no está disponible. Marca el pin o consulta Google Maps.",503);
   const d=await r.json() as {lat:string;lon:string;display_name:string;address?:{road?:string;house_number?:string;city?:string;town?:string;village?:string;country?:string}}[];
   hits=d.map(v=>({lat:Number(v.lat),lng:Number(v.lon),label:v.display_name,address:[v.address?.road,v.address?.house_number].filter(Boolean).join(" ")||undefined,city:v.address?.city||v.address?.town||v.address?.village,country:v.address?.country}));
  }
  hits=hits.slice(0,5).filter(v=>Number.isFinite(v.lat)&&Math.abs(v.lat)<=90&&Number.isFinite(v.lng)&&Math.abs(v.lng)<=180).map(v=>({...v,label:String(v.label||"").slice(0,220)}));
  if(cache.size>=250)cache.delete(cache.keys().next().value!);
  cache.set(key,{expires:Date.now()+24*60*60*1000,hits});
  return Response.json({results:hits,provider},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return responseError(e)}
}
