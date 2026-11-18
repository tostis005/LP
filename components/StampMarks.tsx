"use client";
import type {CSSProperties} from "react";

export const STAMP_OPTIONS=[
 {id:"coffee",label:"Café"},{id:"burger",label:"Hamburguesa"},{id:"beard",label:"Barba"},
 {id:"hair",label:"Peluquería"},{id:"pizza",label:"Pizza"},{id:"croissant",label:"Panadería"},
 {id:"icecream",label:"Helado"},{id:"flower",label:"Flor"},{id:"scissors",label:"Tijeras"},
 {id:"star",label:"Estrella"},{id:"heart",label:"Corazón"},{id:"gift",label:"Regalo"},
 {id:"taco",label:"Taco"},{id:"donut",label:"Dónut"}
] as const;
export type StampKind=typeof STAMP_OPTIONS[number]["id"];
export const DEFAULT_STAMP:StampKind="coffee";
export function StampMark({kind=DEFAULT_STAMP,size=30}:{kind?:string|null;size?:number}){
 const k=STAMP_OPTIONS.some(x=>x.id===kind)?kind:DEFAULT_STAMP;
 const common={fill:"none",stroke:"currentColor",strokeWidth:3.6,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
 return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" {...common}>
  {k==="coffee"&&<><path d="M12 22h33v15a16 16 0 0 1-16 16h-1a16 16 0 0 1-16-16V22Z"/><path d="M45 26h5a9 9 0 0 1 0 18h-8M10 56h39M21 16c-4-5 4-7 0-12M32 17c-4-5 4-7 0-12"/></>}
  {k==="burger"&&<><path d="M11 27a21 21 0 0 1 42 0H11ZM10 35h44M13 42h38M12 48h40v3a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6v-3Z"/><path d="M10 34c5 4 9 0 13 4 4-4 7 0 11-3 4 4 7 0 11 4 4-4 6 0 9-4"/><path d="M22 19h1m9-4h1m8 6h1"/></>}
  {k==="beard"&&<><path d="M20 23c1-10 7-15 12-15s11 5 12 15M18 27c-6-5-9-1-8 5 0 5 5 8 10 9 1 13 9 20 12 20s11-7 12-20c5-1 10-4 10-9 1-6-2-10-8-5"/><path d="M19 30c4-5 8-5 13 0 5-5 9-5 13 0M25 41c3 3 11 3 14 0M28 50c2 2 6 2 8 0"/></>}
  {k==="hair"&&<><path d="M11 34c-3-17 6-28 21-28 17 0 24 12 21 28M14 29c8 0 14-6 17-13 3 8 10 13 19 13"/><path d="M18 28v10c0 12 6 20 14 20s14-8 14-20V28M15 42c-5-1-8-6-7-11M49 42c5-1 8-6 7-11"/><path d="M25 44c4 3 10 3 14 0"/></>}
  {k==="pizza"&&<><path d="M8 18 56 9 39 57 8 18Z"/><path d="M9 18c14-1 24 3 40 11M23 28h1m16 8h1m-13 9h1"/><circle cx="31" cy="23" r="4"/><circle cx="31" cy="37" r="4"/></>}
  {k==="croissant"&&<><path d="M12 43c-2-14 5-25 16-30 6 2 10 5 12 10 7 1 11 5 13 12-7 15-23 21-41 8Z"/><path d="M12 43c1-7 5-14 12-19M28 13c-4 6-4 14 0 23M40 23c-5 5-8 13-7 24M53 35c-5 4-10 6-16 7"/></>}
  {k==="icecream"&&<><path d="m23 34 9 27 9-27H23Z"/><path d="M15 34a10 10 0 0 1 9-14 13 13 0 0 1 25 0 10 10 0 0 1 0 14H15Z"/><path d="M25 17c-5-7 0-12 7-13 7 1 12 6 7 13"/></>}
  {k==="flower"&&<><circle cx="32" cy="30" r="6"/><path d="M32 23c-14-17 14-23 12-6 18-8 21 16 3 15 11 18-13 26-15 8-15 17-28-6-10-13C5 16 25 7 32 23ZM32 37v23m0-10c-6-7-11-7-15-5m15 8c5-7 10-9 16-8"/></>}
  {k==="scissors"&&<><circle cx="17" cy="17" r="9"/><circle cx="17" cy="47" r="9"/><path d="m24 22 31 34M24 42 55 8M31 31l24-23"/></>}
  {k==="star"&&<path d="m32 5 8 18 20 2-15 14 4 20-17-10-17 10 4-20L4 25l20-2 8-18Z"/>}
  {k==="heart"&&<path d="M32 56 9 35C-3 22 13 6 26 16l6 7 6-7C51 6 67 22 55 35L32 56Z"/>}
  {k==="gift"&&<><rect x="8" y="24" width="48" height="33" rx="4"/><path d="M5 24h54v10H5zM32 24v33M32 24C23 7 11 12 13 20c2 6 12 4 19 4Zm0 0c9-17 21-12 19-4-2 6-12 4-19 4Z"/></>}
  {k==="taco"&&<><path d="M7 45A25 25 0 0 1 57 45H7Z"/><path d="M13 40c2-10 9-17 19-17s17 7 19 17M14 31c4-4 7-1 11-2s7-6 12-1 9 0 13 4M18 46h28"/></>}
  {k==="donut"&&<><circle cx="32" cy="32" r="25"/><circle cx="32" cy="32" r="9"/><path d="M12 20c5-6 8 3 14-3 4-4 7-2 11 0 5 3 7-4 14 2M11 40c8 2 7-5 13-4m18 6c5-1 7-5 10-8M22 52l3-4m18-19 4-2"/></>}
 </svg>;
}
export function StampGrid({total,earned,kind=DEFAULT_STAMP,imageUrl,color,className=""}:{total:number;earned:number;kind?:string|null;imageUrl?:string|null;color?:string|null;className?:string}){
 const count=Math.min(30,Math.max(1,Math.floor(Number(total)||8)));
 const filled=Math.max(0,Math.floor(Number(earned)||0));
 const cols=count<=6?count:Math.min(6,Math.ceil(count/Math.ceil(count/6)));
 return <div className={"stamp-grid "+className} role="img" aria-label={Math.min(filled,count)+" de "+count+" sellos"} style={{"--stamp-columns":String(cols)} as CSSProperties}>
  {Array.from({length:count},(_,i)=><div className={"stamp-slot"+(i<filled?" is-filled":"")} key={i} style={i<filled&&color?{color}:undefined}>
   {i<filled&&(imageUrl?<img src={imageUrl} alt="" loading="lazy"/>:<StampMark kind={kind} size={24}/>)}
  </div>)}
 </div>;
}
