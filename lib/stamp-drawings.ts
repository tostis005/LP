/**
 * Galería conceptual de Loyally.
 * Una sola colección de dibujos monocromos para sellos, tarjetas y marcadores.
 * Diseño de 64 × 64: pocos trazos redondeados, sin rellenos ni detalles superfluos.
 * Cada dibujo es una constante interna, nunca HTML suministrado por un usuario.
 */
export const STAMP_DRAWINGS = {
 coffee:'<path d="M17 24h27v17c0 8-6 13-13.5 13S17 49 17 41V24Z"/><path d="M44 28h5c6 0 9 4 9 9s-3 9-9 9h-5M14 58h38M24 18c-4-4 4-7 0-11M34 18c-4-4 4-7 0-11"/>',
 burger:'<path d="M10 27c2-12 10-18 22-18s20 6 22 18H10ZM10 47h44v4c0 5-5 8-10 8H20c-5 0-10-3-10-8v-4Z"/><path d="M8 34h48M10 40c6-4 10 4 16 0s10 4 16 0 10 4 12 0M23 19h1M32 17h1M41 19h1"/>',
 restaurant:'<circle cx="32" cy="34" r="17"/><circle cx="32" cy="34" r="10"/><path d="M7 13v15c0 4 6 5 6 0V13M13 28v27M52 13c-7 7-8 17 0 22v20"/>',
 // Solo bigote y barba: sin cabeza, ojos, nariz ni facciones.
 beard:'<path d="M32 26c-5-7-11-9-16-6-4 3-7 6-12 5 4 9 15 13 28 1ZM32 26c5-7 11-9 16-6 4 3 7 6 12 5-4 9-15 13-28 1Z"/><path d="M17 37c1 10 5 17 15 22 10-5 14-12 15-22M23 39c0 8 3 12 9 16 6-4 9-8 9-16"/>',
 // Melena/peluca conceptual con raya y mechones: sin rostro.
 hair:'<path d="M13 55c-3-7-4-18-2-27C13 15 21 8 32 8s19 7 21 20c2 9 1 20-2 27-5 3-11 0-14-5M27 50c-4 5-9 8-14 5"/><path d="M11 31c9-1 16-6 21-17 5 11 12 16 21 17M18 35c0 7-1 13-5 20M46 35c0 7 1 13 5 20"/>',
 pizza:'<path d="M8 17c16-8 32-8 48 0L32 57 8 17Z"/><path d="M11 24c14-5 28-5 42 0"/><circle cx="27" cy="34" r="3.5"/><circle cx="40" cy="32" r="3.5"/><circle cx="33" cy="46" r="3.5"/>',
 bread:'<path d="M8 41c0-13 10-24 24-24s24 11 24 24c0 9-8 14-24 14S8 50 8 41Z"/><path d="M17 28c4 3 7 8 8 13M29 22c4 4 7 10 8 16M41 27c4 3 6 8 7 13"/>',
 croissant:'<path d="M6 45c3-12 10-19 20-24l6 7 6-7c10 5 17 12 20 24-5 8-12 10-19 5-4 5-10 5-14 0-7 5-14 3-19-5Z"/><path d="M26 21c-6 10-8 21-1 29M38 21c6 10 8 21 1 29"/>',
 icecream:'<path d="M22 35 32 58l10-23H22Z"/><path d="M15 35c-4-5-1-12 6-14 1-7 5-12 11-12s10 5 11 12c7 2 10 9 6 14H15Z"/>',
 flower:'<circle cx="32" cy="26" r="5"/><path d="M32 20c-7-17-19-4-11 5-16-6-15 10-2 11-9 12 6 17 13 5 7 12 22 7 13-5 13-1 14-17-2-11 8-9-4-22-11-5ZM32 42v18m0-8c-6-6-12-7-17-5m17 10c6-6 12-8 17-6"/>',
 scissors:'<circle cx="16" cy="16" r="8"/><circle cx="16" cy="48" r="8"/><path d="m22 22 34 34M22 42 56 8"/>',
 star:'<path d="m32 7 8 17 19 3-14 13 4 18-17-9-17 9 4-18L5 27l19-3 8-17Z"/>',
 heart:'<path d="M32 56 10 36C-4 22 12 7 25 18l7 6 7-6C52 7 68 22 54 36L32 56Z"/>',
 gift:'<rect x="11" y="29" width="42" height="29" rx="3"/><path d="M7 29h50v10H7zM32 29v29M32 29c-14-3-20-13-14-17 7-5 14 7 14 17Zm0 0c14-3 20-13 14-17-7-5-14 7-14 17Z"/>',
 taco:'<path d="M8 51c1-19 11-32 24-32s23 13 24 32H8Z"/><path d="M12 43c4-6 8-3 12-9 5-5 11-5 16 0 4 6 8 3 12 9M17 47c4-3 9-2 15-2s11-1 15 2"/>',
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
 return '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="'+scale+'" height="'+scale+'" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">'+STAMP_DRAWINGS[validated]+'</svg>';
}
