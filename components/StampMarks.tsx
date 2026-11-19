"use client";
import type {CSSProperties} from "react";

export const STAMP_OPTIONS=[
 {id:"coffee",label:"Café"},{id:"burger",label:"Hamburguesa"},{id:"beard",label:"Barba"},
 {id:"hair",label:"Peluquería"},{id:"pizza",label:"Pizza"},{id:"croissant",label:"Panadería"},
 {id:"icecream",label:"Helado"},{id:"flower",label:"Flor"},{id:"scissors",label:"Tijeras"},
 {id:"star",label:"Estrella"},{id:"heart",label:"Corazón"},{id:"gift",label:"Regalo"},
 {id:"taco",label:"Taco"},{id:"donut",label:"Dónut"},
 {id:"gym",label:"Gimnasio"},{id:"spa",label:"Spa"},{id:"pet",label:"Mascotas"},
 {id:"nails",label:"Manicura"},{id:"book",label:"Libros"},{id:"car",label:"Automóvil"},
 {id:"bicycle",label:"Bicicleta"},{id:"juice",label:"Zumos"}
] as const;
export type StampKind=typeof STAMP_OPTIONS[number]["id"];
export const DEFAULT_STAMP:StampKind="coffee";
export function StampMark({kind=DEFAULT_STAMP,size=30}:{kind?:string|null;size?:number}){
 const k=STAMP_OPTIONS.some(x=>x.id===kind)?kind:DEFAULT_STAMP;
 const common={fill:"none",stroke:"currentColor",strokeWidth:3.6,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
 return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" {...common}>
  {k==="coffee"&&<><path d="M12 22h33v15a16 16 0 0 1-16 16h-1a16 16 0 0 1-16-16V22Z"/><path d="M45 26h5a9 9 0 0 1 0 18h-8M10 56h39M21 16c-4-5 4-7 0-12M32 17c-4-5 4-7 0-12"/></>}
  {k==="burger"&&<><path d="M11 27a21 21 0 0 1 42 0H11ZM10 35h44M13 42h38M12 48h40v3a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6v-3Z"/><path d="M10 34c5 4 9 0 13 4 4-4 7 0 11-3 4 4 7 0 11 4 4-4 6 0 9-4"/><path d="M22 19h1m9-4h1m8 6h1"/></>}
  {k==="beard"&&<><path fill="currentColor" strokeWidth="1.2" d="M32 28c-10-10-17-12-24-2-5 8 0 15 8 16-1 10 5 16 11 20l5-6 5 6c6-4 12-10 11-20 8-1 13-8 8-16-7-10-14-8-24 2z"/><path fill="none" strokeWidth="2.2" d="M9 27c6-3 14-1 23 4 9-5 17-7 23-4M26 44c4 3 8 3 12 0"/></>}
  {k==="hair"&&<><path fill="currentColor" strokeWidth="1.3" d="M7 52c3-9 2-18 2-24C9 13 18 5 32 5s23 8 23 23c0 6-1 15 2 24-8 5-14 5-18-2l-2-15c-2-2-4-5-5-9-4 7-10 10-15 10v14c-3 7-10 7-10 2z"/><path stroke="currentColor" strokeWidth="2.8" fill="none" d="M12 28c5-2 13-8 18-15m4-2c1 10 7 18 18 22m-32 7c0 6-1 10-4 13m28-13c0 6 1 10 4 13"/></>}
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
  {k==="gym"&&<><path d="M5 28h7v-8h7v24h-7v-8H5v-8Zm54 0h-7v-8h-7v24h7v-8h7v-8ZM19 31h26v4H19z" strokeWidth="3.5"/></>}
  {k==="spa"&&<><path d="M32 51c-16-6-23-18-20-30 10 0 18 6 20 16 2-10 10-16 20-16 3 12-4 24-20 30z"/><path d="M32 34c-7-10-5-20 0-27 5 7 7 17 0 27ZM8 47c10 0 17 4 24 10 7-6 14-10 24-10"/></>}
  {k==="pet"&&<><circle cx="12" cy="22" r="6"/><circle cx="26" cy="13" r="6"/><circle cx="42" cy="13" r="6"/><circle cx="55" cy="24" r="6"/><path d="M32 30c-7 0-10 7-16 14-7 9-1 17 8 14 5-2 11-2 16 0 9 3 15-5 8-14-6-7-9-14-16-14Z"/></>}
  {k==="nails"&&<><path d="M15 43V21c0-6 9-6 9 0v10-19c0-6 9-6 9 0v19-14c0-6 9-6 9 0v18-8c0-6 9-6 9 0v19c0 10-8 16-19 16H23c-10 0-15-7-17-16-1-7 5-9 9-3Z"/></>}
  {k==="book"&&<><path d="M32 12c-8-5-17-7-25-5v42c10-2 18 0 25 6 7-6 15-8 25-6V7c-8-2-17 0-25 5ZM32 12v43M13 17c6 0 10 1 14 4m10 0c4-3 8-4 14-4M13 30c6 0 10 1 14 4m10 0c4-3 8-4 14-4"/></>}
  {k==="car"&&<><path d="M11 27 17 13h30l6 14 5 4v19H6V31l5-4Zm0 0h42M17 50v8H9v-8m46 0v8h-8v-8M18 39h8m12 0h8"/></>}
  {k==="bicycle"&&<><circle cx="14" cy="45" r="11"/><circle cx="51" cy="45" r="11"/><path d="m14 45 13-23 12 23H14Zm25 0 12-24h-9M25 22h-8m10 0-4-8h-7"/></>}
  {k==="juice"&&<><path d="M16 22h35l-5 35H21l-5-35ZM12 16h43M29 16 39 4h12M25 37h18M30 44h8"/></>}
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
