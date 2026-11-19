import {actorFromRequest,ApiError,checkOrigin,responseError} from "@/lib/server/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Hit={lat:number;lng:number;label:string};
const cache=new Map<string,{expires:number;hits:Hit[]}>();
let lastLookup=0;

export async function POST(request:Request){
 try{
  checkOrigin(request);
  const user=await actorFromRequest(request);
  if(!user)throw new ApiError("Inicia sesión para buscar direcciones.",401);
  const raw=await request.text();
  if(raw.length>600)throw new ApiError("La dirección es demasiado larga.",413);
  const input=JSON.parse(raw) as {q?:string};
  const q=String(input.q||"").trim().replace(/\s+/g," ");
  if(q.length<7||q.length>220)throw new ApiError("Introduce una dirección válida.");
  const key=q.toLowerCase(),cached=cache.get(key);
  if(cached&&cached.expires>Date.now())return Response.json({results:cached.hits});
  const now=Date.now();
  if(now-lastLookup<1300)throw new ApiError("Hay muchas búsquedas. Inténtalo de nuevo en unos segundos.",429);
  lastLookup=now;
  const base=process.env.NEXT_PUBLIC_SITE_URL||"https://169.58.121.198";
  const u=new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q",q);u.searchParams.set("format","jsonv2");u.searchParams.set("limit","5");u.searchParams.set("addressdetails","0");
  const r=await fetch(u.toString(),{headers:{
   "User-Agent":"Loyally/1.0 (address-search; "+base+")",
   "Referer":base,
   "Accept-Language":"es"
  },signal:AbortSignal.timeout(11000),cache:"no-store"});
  if(!r.ok)throw new ApiError("El buscador de direcciones no está disponible.",503);
  const json=await r.json() as {lat:string;lon:string;display_name:string}[];
  const hits=json.slice(0,5).map(v=>({lat:Number(v.lat),lng:Number(v.lon),label:String(v.display_name||"").slice(0,220)}))
   .filter(v=>Number.isFinite(v.lat)&&Math.abs(v.lat)<=90&&Number.isFinite(v.lng)&&Math.abs(v.lng)<=180);
  if(cache.size>100)cache.delete(cache.keys().next().value!);
  cache.set(key,{expires:Date.now()+24*60*60*1000,hits});
  return Response.json({results:hits},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return responseError(e)}
}
