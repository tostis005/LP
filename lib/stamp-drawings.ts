/**
 * Una sola colección de ilustraciones lineales para sellos y mapa.
 * Los trazos se diseñan en 64x64 con márgenes de seguridad y sin rellenos.
 * Las cadenas son constantes internas, no se construyen con datos de usuarios.
 */
export const STAMP_DRAWINGS = {
 coffee: '<path d="M12 23h34v16a15 15 0 0 1-15 15h-4a15 15 0 0 1-15-15V23Z"/><path d="M46 28h4a8 8 0 0 1 0 16h-5M9 57h42M21 16c-4-4 4-7 0-11M33 16c-4-4 4-7 0-11"/>',
 burger: '<path d="M10 26c1-12 10-19 22-19s21 7 22 19H10ZM10 47h44v3a7 7 0 0 1-7 7H17a7 7 0 0 1-7-7v-3Z"/><path d="M9 33h46M12 40h40M13 34l7 5 8-5 8 5 8-5 7 5M21 18l2 1m8-5 2 1m9 3 2 1"/>',
 // Bigote curvado y barba definida: expresamente sin nariz, ojos ni cabeza.
 beard: '<path d="M32 25c-5-8-11-10-16-8-4 1-6 5-8 9-2 5-4 6-7 7 8 6 17 5 23-1l8-7Z"/><path d="M32 25c5-8 11-10 16-8 4 1 6 5 8 9 2 5 4 6 7 7-8 6-17 5-23-1l-8-7Z"/><path d="M18 37c0 11 5 19 14 24 9-5 14-13 14-24M23 39c-1 7 2 13 9 17 7-4 10-10 9-17M27 39c3 2 7 2 10 0"/>',
 // Peluca/cabello: flequillo y mechones sueltos, sin rasgos de cara.
 hair: '<path d="M11 53c5-8 3-16 3-24C14 15 22 7 32 7s18 8 18 22c0 8-2 16 3 24-6 4-13 1-15-6M26 47c-2 7-9 10-15 6"/><path d="M15 31c6-2 13-7 17-15 3 8 10 13 17 15"/><path d="M20 30c0 9-2 15-5 19m29-19c0 9 2 15 5 19M25 22c-2 6-5 10-8 13m20-13c2 6 5 10 8 13M32 16v19"/><path d="M22 54c4 3 8 3 10 0 3 3 7 3 10 0"/>',
 // Pizza triangular con borde curvo, queso y rodajas identificables.
 pizza: '<path d="M9 17c12-7 29-8 46-1L33 58 9 17Z"/><path d="M9 17c13 1 24 6 38 14M12 13c15-7 31-6 45 0"/><circle cx="29" cy="28" r="4"/><circle cx="36" cy="40" r="4"/><path d="m21 39 1 2m20-17 1 1"/>',
 // Croissant real: extremos finos, cuerpo abombado y pliegues del hojaldre.
 croissant: '<path d="M8 41c2-12 9-22 19-28l5 6 5-6c10 6 17 16 19 28-6 9-15 13-24 13S14 50 8 41Z"/><path d="M8 41c7 1 13-2 17-8m31 8c-7 1-13-2-17-8M27 13c-6 11-6 24-2 36m12-36c6 11 6 24 2 36M25 33c2-5 4-9 7-14 3 5 5 9 7 14"/>',
 // Pan de masa madre con tres cortes: categoría panadería.
 bread: '<path d="M9 32c0-13 10-23 23-23s23 10 23 23v16c0 6-5 10-11 10H20c-6 0-11-4-11-10V32Z"/><path d="M19 31c4 3 7 7 8 12M31 25c4 4 7 8 7 14M43 30c4 3 6 7 7 11M9 48h46"/>',
 icecream: '<path d="m22 35 10 25 10-25H22Z"/><path d="M15 35c-3-6 0-13 6-15 0-7 5-12 11-12s11 5 11 12c6 2 9 9 6 15H15Z"/><path d="M23 22c4-4 8-2 9 1 3-4 8-5 12-2m-17 19 7 16"/>',
 flower: '<circle cx="32" cy="28" r="6"/><path d="M32 21c-8-15 11-21 13-7 14-8 21 8 8 15 10 12-4 23-15 13-9 13-23 4-18-9-15 0-15-19 2-18 2-14 18-10 10 6ZM32 35v25m0-14c-5-6-11-8-17-6m17 12c5-7 10-9 16-8"/>',
 scissors: '<circle cx="15" cy="16" r="8"/><circle cx="15" cy="48" r="8"/><path d="m22 22 34 33M22 42 56 9M31 31l25-22"/>',
 star: '<path d="m32 6 8 18 19 2-14 13 4 19-17-10-17 10 4-19L5 26l19-2 8-18Z"/>',
 heart: '<path d="M32 55 9 34C-2 23 12 7 25 16l7 7 7-7c13-9 27 7 16 18L32 55Z"/>',
 gift: '<rect x="9" y="26" width="46" height="31" rx="4"/><path d="M6 26h52v11H6zM32 26v31M32 26c-10-15-20-13-19-5 1 6 10 5 19 5Zm0 0c10-15 20-13 19-5-1 6-10 5-19 5Z"/>',
 taco: '<path d="M8 47a24 24 0 0 1 48 0H8Z"/><path d="M14 38c6-5 10-3 15-5 4-2 6-2 10 1 4 3 8-1 12 4M16 44c6-3 10-2 15 0 4-3 10-3 17-1M12 52h40"/>',
 donut: '<circle cx="32" cy="32" r="25"/><circle cx="32" cy="32" r="9"/><path d="M10 24c6-6 12 1 18-6 5-5 8-2 14 0 7 3 9-3 12 3M12 43c6 2 9-5 15-3m14 4c4 1 9-3 11-7M22 51l2-4m20-16 3-2"/>',
 gym: '<path d="M6 27h7v-8h8v26h-8v-8H6V27Zm52 0h-7v-8h-8v26h8v-8h7V27ZM21 30h22v7H21Z"/>',
 spa: '<path d="M32 53C14 46 9 35 12 22c11 0 19 6 20 15 1-9 9-15 20-15 3 13-2 24-20 31Z"/><path d="M32 35c-7-10-6-21 0-28 6 7 7 18 0 28ZM10 51c9 0 15 3 22 9 7-6 13-9 22-9"/>',
 pet: '<circle cx="13" cy="24" r="6"/><circle cx="26" cy="14" r="6"/><circle cx="42" cy="14" r="6"/><circle cx="54" cy="25" r="6"/><path d="M32 30c-7 0-11 7-16 14-6 8 0 16 8 13 5-2 11-2 16 0 8 3 14-5 8-13-5-7-9-14-16-14Z"/>',
 nails: '<path d="M15 41V20c0-6 9-6 9 0v9-17c0-6 9-6 9 0v17-13c0-6 9-6 9 0v17-8c0-6 9-6 9 0v18c0 10-7 16-18 16H24c-10 0-15-7-17-16-1-7 4-10 8-2Z"/>',
 book: '<path d="M32 13c-7-5-17-7-25-5v42c10-2 18 0 25 6 7-6 15-8 25-6V8c-8-2-18 0-25 5ZM32 13v43M13 20c5 0 10 1 14 3m10 0c4-2 8-3 14-3M13 33c5 0 10 1 14 3m10 0c4-2 8-3 14-3"/>',
 car: '<path d="m10 29 7-16h30l7 16 4 5v18H6V34l4-5Zm0 0h44M16 52v6H9v-6m46 0v6h-7v-6M16 41h10m12 0h10"/><circle cx="21" cy="41" r="2"/><circle cx="43" cy="41" r="2"/>',
 bicycle: '<circle cx="15" cy="46" r="11"/><circle cx="50" cy="46" r="11"/><path d="m15 46 12-23 12 23H15Zm24 0 11-24h-9M26 23h-8m9 0-4-9h-8"/>',
 juice: '<path d="M16 23h34l-5 34H21l-5-34ZM13 16h42M29 16 41 5h10M25 36h16M29 45h9"/>',
} as const;

export type StampKind=keyof typeof STAMP_DRAWINGS;
export const STAMP_OPTIONS:ReadonlyArray<{id:StampKind;label:string}>=[
 {id:"coffee",label:"Café"},{id:"burger",label:"Hamburguesa"},{id:"beard",label:"Bigote y barba"},
 {id:"hair",label:"Peluquería"},{id:"pizza",label:"Pizza"},{id:"bread",label:"Pan"},
 {id:"croissant",label:"Croissant"},{id:"icecream",label:"Helado"},{id:"flower",label:"Flor"},
 {id:"scissors",label:"Tijeras"},{id:"star",label:"Estrella"},{id:"heart",label:"Corazón"},
 {id:"gift",label:"Regalo"},{id:"taco",label:"Taco"},{id:"donut",label:"Dónut"},
 {id:"gym",label:"Gimnasio"},{id:"spa",label:"Spa"},{id:"pet",label:"Mascotas"},
 {id:"nails",label:"Manicura"},{id:"book",label:"Libros"},{id:"car",label:"Automóvil"},
 {id:"bicycle",label:"Bicicleta"},{id:"juice",label:"Zumos"}
];
export const DEFAULT_STAMP:StampKind="coffee";

export function stampMarkup(kind?:string|null,size=28):string {
 const validated=kind && Object.prototype.hasOwnProperty.call(STAMP_DRAWINGS,kind)?kind as StampKind:DEFAULT_STAMP;
 const scale=Math.max(10,Math.min(200,Math.round(size)));
 return '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="'+scale+'" height="'+scale+'" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'+STAMP_DRAWINGS[validated]+'</svg>';
}
