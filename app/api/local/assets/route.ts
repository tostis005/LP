import { mkdir,writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
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
  const expected:Record<string,string[]>={"image/png":[".png"],"image/jpeg":[".jpg",".jpeg"],"image/webp":[".webp"]};
  if(!expected[file.type]?.includes(ext))throw new ApiError("La extensión no coincide con el tipo de imagen.");
  const image=Buffer.from(await file.arrayBuffer());
  if(!genuine(image,file.type))throw new ApiError("El contenido no corresponde al tipo de imagen indicado.");
  // Los fondos de tarjeta se guardan ya en formato WEBP y con proporción
  // de tarjeta bancaria (1.586). Campañas y logos conservan sus archivos.
  const isCardBackground=match[2].startsWith("cardbg-");
  const outputName=isCardBackground?match[2].replace(/\.(png|jpe?g|webp)$/i,".webp"):match[2];
  let output=image;
  if(isCardBackground){
   try{
    output=await sharp(image,{limitInputPixels:36_000_000,failOn:"error"})
     .rotate().resize(1200,756,{fit:"cover",position:"attention",withoutEnlargement:true})
     .webp({quality:76,effort:4}).toBuffer();
   }catch{throw new ApiError("No se ha podido procesar la imagen. Prueba con otra foto.");}
  }
  const dir=path.join(process.cwd(),"uploads","business-assets",match[1]);
  const full=path.join(dir,outputName);
  await asActor(actor,async client=>{
   // La autorización de imágenes usa el mismo permiso que crear campañas.
   // No depende de los privilegios de escritura directos sobre storage.objects.
   await client.query("SELECT public.register_business_asset($1::uuid,$2::text)",[match[1],outputName]);
   await mkdir(dir,{recursive:true});
   try{await writeFile(full,output,{flag:"wx",mode:0o640})}
   catch(e){throw e}
  });
  return Response.json({path:match[1]+"/"+outputName});
 }catch(e){return responseError(e)}
}