import {readdir,lstat,readFile} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {ApiError} from "./db";
export const maxLibraryBytes=20*1024*1024;
const root=join(process.cwd(),"crm-imports");
const validName=(name:string)=>/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,139}\.csv$/.test(name);
export async function readCityCsv(filename:string){
 if(!validName(filename))throw new ApiError("Nombre de archivo inválido.");
 const path=join(root,filename);
 let info;try{info=await lstat(path);}catch{throw new ApiError("Archivo no encontrado.",404);}
 if(!info.isFile()||info.isSymbolicLink())throw new ApiError("Archivo no permitido.");
 if(info.size>maxLibraryBytes)throw new ApiError("El CSV supera 20 MB.",413);
 const data=await readFile(path);
 if(data.length>maxLibraryBytes)throw new ApiError("El CSV supera 20 MB.",413);
 return {filename,size:data.length,sha256:createHash("sha256").update(data).digest("hex"),data};
}
export async function listCityCsvs(){
 const entries=await readdir(root,{withFileTypes:true});
 const result=[];
 for(const e of entries.filter(e=>e.isFile()&&validName(e.name)).sort((a,b)=>a.name.localeCompare(b.name))){
  const info=await lstat(join(root,e.name));
  if(info.size>maxLibraryBytes){result.push({filename:e.name,size:info.size,sha256:null,error:"Supera 20 MB"});continue;}
  const {filename,size,sha256}=await readCityCsv(e.name);result.push({filename,size,sha256,error:null});
 }
 return result;
}
