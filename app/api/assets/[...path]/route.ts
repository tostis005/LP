import {readFile} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {ApiError,responseError} from "@/lib/server/db";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}) {
 try {
  const {path:parts}=await params;
  if(!Array.isArray(parts)||parts.length!==3||parts[0]!=="business-assets"||
    !/^[a-f0-9-]{36}$/i.test(parts[1])||
    !/^[a-z0-9][a-z0-9._-]{0,140}$/i.test(parts[2])||parts[2].includes(".."))throw new ApiError("Archivo no encontrado.",404);
  const ext=path.extname(parts[2]).toLowerCase();
  const mime:Record<string,string>={".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp"};
  if(!mime[ext])throw new ApiError("Archivo no encontrado.",404);
  const full=path.join(process.cwd(),"uploads",...parts);
  let data:Buffer;
  try{data=await readFile(full)}catch{throw new ApiError("Archivo no encontrado.",404)}
  const width=Number(new URL(request.url).searchParams.get("w")||0);
  // Las fotos existentes se sirven en tamaño de tarjeta bajo demanda.
  // Solo se aceptan dos tamaños: el límite evita transformaciones arbitrarias.
  let contentType=mime[ext];
  if(width===720||width===1200){
   try{
    data=await sharp(data,{limitInputPixels:36_000_000})
     .rotate().resize(width,Math.round(width/1.586),{fit:"cover",position:"attention",withoutEnlargement:true})
     .webp({quality:76,effort:3}).toBuffer();
    contentType="image/webp";
   }catch{throw new ApiError("Imagen no disponible.",404)}
  }
  return new Response(new Uint8Array(data),{headers:{
   "Content-Type":contentType,"Cache-Control":"public, max-age=86400, stale-while-revalidate=604800",
   "X-Content-Type-Options":"nosniff"
  }});
 }catch(e){return responseError(e)}
}