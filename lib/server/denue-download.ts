import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {ApiError} from "./db";
import {decodeDenue} from "./denue";
export const officialTecateArchive="https://www.inegi.org.mx/contenidos/masiva/denue/2025_05/denue_02_0525_csv.zip";
export const officialTecateFilename="DENUE Tecate 2025-05";
const exec=promisify(execFile);
const maxArchive=80*1024*1024;
export async function downloadTecateCsv(){
 const dir=await mkdtemp(join(tmpdir(),"kreyvi-denue-"));
 try{
  const response=await fetch(officialTecateArchive,{signal:AbortSignal.timeout(180000),redirect:"error",cache:"no-store"});
  if(!response.ok||!response.body)throw new ApiError("INEGI no ha entregado el archivo oficial.",502);
  if(Number(response.headers.get("content-length")||0)>maxArchive)throw new ApiError("Archivo DENUE demasiado grande.",502);
  const reader=response.body.getReader(),chunks:Buffer[]=[];let size=0;
  try{
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxArchive)throw new ApiError("Archivo DENUE demasiado grande.",502);chunks.push(Buffer.from(value));}
  }finally{await reader.cancel().catch(()=>{});}
  const archive=join(dir,"denue.zip");const data=Buffer.concat(chunks);
  if(data.subarray(0,4).toString("hex")!=="504b0304")throw new ApiError("INEGI no ha devuelto un ZIP válido.",502);
  await writeFile(archive,data,{mode:0o600});
  const names=(await exec("unzip",["-Z1",archive],{timeout:15000,maxBuffer:1024*1024})).stdout.split(/\r?\n/);
  const entries=names.filter(n=>n.split("/").includes("conjunto_de_datos")&&/\.csv$/i.test(n));
  if(entries.length!==1||!/^[A-Za-z0-9_./-]+$/.test(entries[0])||entries[0].split("/").includes(".."))throw new ApiError("Estructura del ZIP del DENUE inesperada.",502);
  const {stdout}=await exec("unzip",["-p",archive,entries[0]],{encoding:"buffer",timeout:45000,maxBuffer:200*1024*1024});
  return decodeDenue(Uint8Array.from(stdout).buffer);
 }catch(e){if(e instanceof ApiError)throw e;throw new ApiError("No se ha podido descargar o leer el archivo oficial del INEGI.",502);}
 finally{await rm(dir,{recursive:true,force:true});}
}
