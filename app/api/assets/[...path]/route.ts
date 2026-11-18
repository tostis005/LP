import {readFile} from "node:fs/promises";
import path from "node:path";
import {ApiError,responseError} from "@/lib/server/db";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{path:string[]}>}) {
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
  return new Response(new Uint8Array(data),{headers:{
   "Content-Type":mime[ext],"Cache-Control":"public, max-age=3600",
   "X-Content-Type-Options":"nosniff"
  }});
 }catch(e){return responseError(e)}
}