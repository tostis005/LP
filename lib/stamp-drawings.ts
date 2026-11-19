/**
 * Galería conceptual de Loyally.
 * Una sola colección de dibujos monocromos para sellos, tarjetas y marcadores.
 * Diseño de 64 × 64: pocos trazos redondeados, sin rellenos ni detalles superfluos.
 * Cada dibujo es una constante interna, nunca HTML suministrado por un usuario.
 */
export const STAMP_DRAWINGS = {
 coffee:'<path d="M14 28h30v13c0 8-6 13-15 13S14 49 14 41V28Z"/><path d="M44 31h5c10 0 10 15 0 15h-5M11 57h38M22 21c-5-5 4-8 0-13M31 21c-5-5 4-8 0-13M40 21c-5-5 4-8 0-13"/>',
 burger:'<path d="M11 28c1-12 9-19 21-19s20 7 21 19H11ZM11 47h42v3c0 5-4 8-9 8H20c-5 0-9-3-9-8v-3Z"/><path d="M10 35h44M11 40c6-4 11 4 17 0 7-4 11 4 17 0 3-2 6-2 9 0M21 21h1m10-5h1m10 5h1"/>',
 restaurant:'<circle cx="32" cy="34" r="17"/><circle cx="32" cy="34" r="11"/><path d="M7 11v16m6-16v16m6-16v16M13 27v28M52 12c-7 6-7 15 0 19v24"/>',
 // Solo bigote y barba: sin cabeza, ojos, nariz ni facciones.
 beard:'<path d="M32 25c-5-5-9-8-14-6-5 2-7 7-13 7 5 10 15 13 27-1ZM32 25c5-5 9-8 14-6 5 2 7 7 13 7-5 10-15 13-27-1Z"/><path d="M17 38c1 11 6 17 15 22 9-5 14-11 15-22M23 39c0 8 4 13 9 16 5-3 9-8 9-16"/>',
 // Melena/peluca conceptual con raya y mechones: sin rostro.
 hair:'<path d="M13 52c-4-6-3-14-2-22C12 15 21 8 32 8s20 7 21 22c1 8 2 16-2 22-5 4-12 1-15-5M28 47c-3 6-10 9-15 5"/><path d="M11 32c8-2 17-7 21-16 4 9 13 14 21 16M20 31c1 8 0 13-5 19M44 31c-1 8 0 13 5 19"/>',
 pizza:'<path d="M9 16c15-6 31-6 46 0L32 57 9 16Z"/><path d="M12 22c13-5 27-5 40 0"/><circle cx="29" cy="33" r="4"/><circle cx="39" cy="27" r="3"/><circle cx="33" cy="45" r="3"/>',
 bread:'<path d="M7 40c0-12 11-22 25-22s25 10 25 22c0 8-8 14-25 14S7 48 7 40Z"/><path d="M17 28c5 3 8 8 9 13M30 22c5 5 7 10 8 16M43 27c4 4 6 7 6 11"/>',
 croissant:'<path d="M5 44c3-10 10-18 21-24l6 7 6-7c11 6 18 14 21 24-5 9-12 11-19 6-4 5-12 5-16 0-7 5-14 3-19-6Z"/><path d="M26 20c-7 10-9 20-2 30M38 20c7 10 9 20 2 30M15 34c-1 6 1 11 5 14M49 34c1 6-1 11-5 14"/>',
 icecream:'<path d="M23 34 32 58l9-24H23Z"/><path d="M14 35c-4-6 0-13 7-14 1-7 5-12 11-12s10 5 11 12c7 1 11 8 7 14H14Z"/>',
 flower:'<circle cx="32" cy="26" r="5"/><path d="M32 20c-7-17-19-4-11 5-16-6-15 10-2 11-9 12 6 17 13 5 7 12 22 7 13-5 13-1 14-17-2-11 8-9-4-22-11-5ZM32 42v18m0-8c-6-6-12-7-17-5m17 10c6-6 12-8 17-6"/>',
 scissors:'<circle cx="16" cy="16" r="8"/><circle cx="16" cy="48" r="8"/><path d="m22 22 34 34M22 42 56 8"/>',
 star:'<path d="m32 7 8 17 19 3-14 13 4 18-17-9-17 9 4-18L5 27l19-3 8-17Z"/>',
 heart:'<path d="M32 56 10 36C-4 22 12 7 25 18l7 6 7-6C52 7 68 22 54 36L32 56Z"/>',
 gift:'<rect x="11" y="29" width="42" height="29" rx="3"/><path d="M7 29h50v10H7zM32 29v29M32 29c-14-3-20-13-14-17 7-5 14 7 14 17Zm0 0c14-3 20-13 14-17-7-5-14 7-14 17Z"/>',
 taco:'<path d="M8 49c1-18 11-30 24-30s23 12 24 30H8Z"/><path d="M13 41c4-7 8-4 13-10 4-4 9-4 13 0 5 6 9 3 13 10M17 47c4-5 9-3 15-3s11-2 15 3"/>',
 donut:'<circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="8"/><path d="M10 27c8-7 11-1 17-6 7-5 12 2 18 0 5-2 8 0 9 6M17 43c7-2 8 7 15 5 6-2 11-5 15-1"/>',
 gym:'<rect x="6" y="25" width="9" height="18" rx="2"/><rect x="15" y="19" width="10" height="30" rx="2"/><rect x="39" y="19" width="10" height="30" rx="2"/><rect x="49" y="25" width="9" height="18" rx="2"/><path d="M25 34h14"/>',
 spa:'<path d="M10 52c-2-21 12-39 43-42 3 29-13 46-35 44"/><path d="M13 55c11-14 24-24 40-32"/>',
 pet:'<circle cx="13" cy="25" r="5"/><circle cx="26" cy="15" r="5"/><circle cx="41" cy="15" r="5"/><circle cx="53" cy="25" r="5"/><path d="M32 32c-7 0-10 8-15 13-5 6 0 14 8 11 5-2 9-2 14 0 8 3 13-5 8-11-5-5-8-13-15-13Z"/>',
 nails:'<path d="M18 56V29c0-7 10-7 10 0v5-17c0-7 10-7 10 0v17-8c0-7 10-7 10 0v30"/><path d="M18 49c4 4 8 6 14 6h16"/><path d="m52 9 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"/>',
 book:'<path d="M32 16c-7-6-16-8-25-6v39c10-2 19 0 25 6 6-6 15-8 25-6V10c-9-2-18 0-25 6ZM32 16v39"/>',
 car:'<path d="M12 33 18 20h28l6 13M9 33h46c3 0 5 2 5 5v13H4V38c0-3 2-5 5-5Z"/><circle cx="17" cy="43" r="4"/><circle cx="47" cy="43" r="4"/><path d="M11 51v6h8v-6m26 0v6h8v-6"/>',
 bicycle:'<circle cx="14" cy="47" r="11"/><circle cx="50" cy="47" r="11"/><path d="m14 47 13-24 13 24H14Zm26 0 10-24m-23 0h-8m8 0-3-9m19 9h12"/>',
 juice:'<path d="M16 24h32l-4 34H20l-4-34ZM13 18h38M33 18l9-12h9"/>',
} as const;

export type StampKind=keyof typeof STAMP_DRAWINGS;
export const STAMP_OPTIONS:ReadonlyArray<{id:StampKind;label:string}>=[
 {id:"coffee",label:"Café"},{id:"burger",label:"Hamburguesa"},
 {id:"restaurant",label:"Restaurante"},{id:"beard",label:"Barbería"},
 {id:"hair",label:"Peluquería"},{id:"pizza",label:"Pizza"},
 {id:"bread",label:"Panadería"},{id:"croissant",label:"Croissant"},
 {id:"icecream",label:"Helado"},{id:"flower",label:"Floristería"},
 {id:"scissors",label:"Tijeras"},{id:"star",label:"Estrella"},
 {id:"heart",label:"Corazón"},{id:"gift",label:"Regalo"},
 {id:"taco",label:"Taquería"},{id:"donut",label:"Dónut"},
 {id:"gym",label:"Gimnasio"},{id:"spa",label:"Spa"},
 {id:"pet",label:"Mascotas"},{id:"nails",label:"Manicura"},
 {id:"book",label:"Librería"},{id:"car",label:"Automóvil"},
 {id:"bicycle",label:"Bicicleta"},{id:"juice",label:"Zumos"}
];
export const DEFAULT_STAMP:StampKind="coffee";

export function stampMarkup(kind?:string|null,size=28):string {
 const validated=kind && Object.prototype.hasOwnProperty.call(STAMP_DRAWINGS,kind)?kind as StampKind:DEFAULT_STAMP;
 const scale=Math.max(10,Math.min(200,Math.round(size)));
 return '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="'+scale+'" height="'+scale+'" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'+STAMP_DRAWINGS[validated]+'</svg>';
}
