import { mkdir,writeFile,unlink } from "node:fs/promises";
import path from "node:path";
import {actorFromRequest,asActor,ApiError,checkOrigin,responseError} from "@/lib/server/db";
export const runtime="nodejs";
const allowed=new Map([["image/png","png"],["image/jpeg","jpeg"],["image/webp","webp"]]);
function genuine(data:Buffer,mime:string) {
 if(mime==="image/png")return data.subarray(0,8).toString("hex")==="89504e470d0a1a0a";
 if(mime==="image/jpeg")return data.subarray(0,3).toString("hex")==="ffd8ff";
 if(mime==="image/webp")return data.subarray(0,4).toString("ascii")==="RIFF"&&data.subarray(8,12).toString("ascii")==="WEBP";
 return false;
}
export async function POST(request:Request) {
 try {
  checkOrigin(request);
  const actor=await actorFromRequest(request);
  if(!actor)throw new ApiError("Inicia sesión para subir imágenes.",401);
  const data=await request.formData();
  const bucket=data.get("bucket"),key=data.get("path"),file=data.get("file");
  if(bucket!=="business-assets"||typeof key!=="string"||!(file instanceof File))throw new ApiError("Solicitud de archivo no válida.");
  const match=key.match(/^([a-f0-9-]{36})\/([a-z0-9][a-z0-9._-]{0,140})$/i);
  if(!match||match[2].includes(".."))throw new ApiError("Nombre de archivo no permitido.");
  if(file.size>5242880||file.size<8||!allowed.has(file.type))throw new ApiError("Solo imágenes JPG, PNG y WEBP de hasta 5 MB.");
  const ext=path.extname(match[2]).toLowerCase();
  if(![".jpg",".jpeg",".png",".webp"].includes(ext))throw new ApiError("Extensión de archivo no permitida.");
  const image=Buffer.from(await file.arrayBuffer());
  if(!genuine(image,file.type))throw new ApiError("El contenido no corresponde al tipo de imagen indicado.");
  const dir=path.join(process.cwd(),"uploads","business-assets",match[1]);
  const full=path.join(dir,match[2]);
  await asActor(actor,async client=>{
   await client.query("INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)",[bucket,key]);
   await mkdir(dir,{recursive:true});
   try{await writeFile(full,image,{flag:"wx",mode:0o640})}
   catch(e){await unlink(full).catch(()=>{});throw e}
  });
  return Response.json({path:key});
 }catch(e){return responseError(e)}
}